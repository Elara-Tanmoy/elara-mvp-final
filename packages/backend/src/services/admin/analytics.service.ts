import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { logger } from '../../config/logger.js';

/**
 * Advanced Analytics Service for Admin Panel
 * Provides real-time analytics, reporting, and insights
 */

export interface TimeSeriesData {
  timestamp: Date;
  value: number;
  label?: string;
}

export interface UserAnalytics {
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  usersByTier: { tier: string; count: number; percentage: number }[];
  usersByRole: { role: string; count: number }[];
  userGrowth: TimeSeriesData[];
  retentionRate: number;
  churnRate: number;
}

export interface UsageAnalytics {
  totalScans: number;
  scansToday: number;
  scansThisWeek: number;
  scansThisMonth: number;
  scansByType: { type: string; count: number; percentage: number }[];
  scansByTier: { tier: string; count: number }[];
  averageScansPerUser: number;
  peakUsageHours: { hour: number; count: number }[];
  scanTrends: TimeSeriesData[];
}

export interface RevenueAnalytics {
  totalRevenue: number;
  monthlyRecurringRevenue: number;
  averageRevenuePerUser: number;
  revenueByPlan: { plan: string; revenue: number; percentage: number }[];
  revenueGrowth: TimeSeriesData[];
  lifetimeValue: number;
  conversionRate: number;
}

export interface SystemAnalytics {
  apiRequests: number;
  apiRequestsToday: number;
  averageResponseTime: number;
  errorRate: number;
  uptime: number;
  activeConnections: number;
  databaseSize: number;
  cacheHitRate: number;
  requestsByEndpoint: { endpoint: string; count: number; avgTime: number }[];
  errorsByType: { type: string; count: number }[];
}

export interface ExportOptions {
  format: 'csv' | 'json' | 'pdf';
  dateRange?: { start: Date; end: Date };
  filters?: Record<string, any>;
  includeCharts?: boolean;
}

export class AnalyticsService {
  private prisma: PrismaClient;
  private pool: Pool;

  constructor() {
    this.prisma = new PrismaClient();
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
  }

  /**
   * Get comprehensive user analytics
   */
  async getUserAnalytics(days: number = 30): Promise<UserAnalytics> {
    try {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      // Total and active users
      const [totalUsers, activeUsers] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({ where: { isActive: true } })
      ]);

      // New users breakdown
      const [newUsersToday, newUsersThisWeek, newUsersThisMonth] = await Promise.all([
        this.prisma.user.count({ where: { createdAt: { gte: startOfToday } } }),
        this.prisma.user.count({ where: { createdAt: { gte: startOfWeek } } }),
        this.prisma.user.count({ where: { createdAt: { gte: startOfMonth } } })
      ]);

      // Users by tier
      const usersByTierRaw = await this.pool.query(`
        SELECT o.tier, COUNT(DISTINCT u.id)::int as count
        FROM "User" u
        LEFT JOIN "Organization" o ON u."organizationId" = o.id
        GROUP BY o.tier
      `);

      const usersByTier = usersByTierRaw.rows.map((row: any) => ({
        tier: row.tier || 'free',
        count: row.count,
        percentage: (row.count / totalUsers) * 100
      }));

      // Users by role
      const usersByRoleRaw = await this.pool.query(`
        SELECT role, COUNT(*)::int as count
        FROM "User"
        GROUP BY role
      `);

      const usersByRole = usersByRoleRaw.rows.map((row: any) => ({
        role: row.role,
        count: row.count
      }));

      // User growth over time (daily)
      const userGrowthRaw = await this.pool.query(`
        SELECT
          DATE("createdAt") as date,
          COUNT(*)::int as count
        FROM "User"
        WHERE "createdAt" >= $1
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `, [startDate]);

      const userGrowth: TimeSeriesData[] = userGrowthRaw.rows.map((row: any) => ({
        timestamp: new Date(row.date),
        value: row.count,
        label: new Date(row.date).toLocaleDateString()
      }));

      // Calculate retention rate (users active in last 7 days / total users)
      const activeInLast7Days = await this.prisma.user.count({
        where: {
          OR: [
            { lastLoginAt: { gte: startOfWeek } },
            { updatedAt: { gte: startOfWeek } }
          ]
        }
      });
      const retentionRate = (activeInLast7Days / totalUsers) * 100;

      // Calculate churn rate (inactive users / total users)
      const inactiveUsers = totalUsers - activeUsers;
      const churnRate = (inactiveUsers / totalUsers) * 100;

      return {
        totalUsers,
        activeUsers,
        newUsersToday,
        newUsersThisWeek,
        newUsersThisMonth,
        usersByTier,
        usersByRole,
        userGrowth,
        retentionRate,
        churnRate
      };
    } catch (error) {
      logger.error('[Analytics] Error getting user analytics:', error);
      throw error;
    }
  }

  /**
   * Get usage analytics
   */
  async getUsageAnalytics(days: number = 30): Promise<UsageAnalytics> {
    try {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      // Get total scans from ScanHistory table
      const scanHistoryCount = await this.pool.query(`
        SELECT COUNT(*)::int as total FROM "ScanHistory"
      `);
      const totalScans = scanHistoryCount.rows[0]?.total || 0;

      // Scans breakdown
      const [scansToday, scansThisWeek, scansThisMonth] = await Promise.all([
        this.pool.query(`SELECT COUNT(*)::int as count FROM "ScanHistory" WHERE "createdAt" >= $1`, [startOfToday]),
        this.pool.query(`SELECT COUNT(*)::int as count FROM "ScanHistory" WHERE "createdAt" >= $1`, [startOfWeek]),
        this.pool.query(`SELECT COUNT(*)::int as count FROM "ScanHistory" WHERE "createdAt" >= $1`, [startOfMonth])
      ]);

      // Scans by type
      const scansByTypeRaw = await this.pool.query(`
        SELECT type, COUNT(*)::int as count
        FROM "ScanHistory"
        GROUP BY type
      `);

      const scansByType = scansByTypeRaw.rows.map((row: any) => ({
        type: row.type,
        count: row.count,
        percentage: (row.count / totalScans) * 100
      }));

      // Scans by user tier
      const scansByTierRaw = await this.pool.query(`
        SELECT o.tier, COUNT(s.id)::int as count
        FROM "ScanHistory" s
        JOIN "User" u ON s."userId" = u.id
        LEFT JOIN "Organization" o ON u."organizationId" = o.id
        GROUP BY o.tier
      `);

      const scansByTier = scansByTierRaw.rows.map((row: any) => ({
        tier: row.tier || 'free',
        count: row.count
      }));

      // Average scans per user
      const totalUsers = await this.prisma.user.count();
      const averageScansPerUser = totalUsers > 0 ? totalScans / totalUsers : 0;

      // Peak usage hours
      const peakUsageRaw = await this.pool.query(`
        SELECT
          EXTRACT(HOUR FROM "createdAt")::int as hour,
          COUNT(*)::int as count
        FROM "ScanHistory"
        WHERE "createdAt" >= $1
        GROUP BY EXTRACT(HOUR FROM "createdAt")
        ORDER BY count DESC
        LIMIT 10
      `, [startOfWeek]);

      const peakUsageHours = peakUsageRaw.rows.map((row: any) => ({
        hour: row.hour,
        count: row.count
      }));

      // Scan trends over time
      const scanTrendsRaw = await this.pool.query(`
        SELECT
          DATE("createdAt") as date,
          COUNT(*)::int as count
        FROM "ScanHistory"
        WHERE "createdAt" >= $1
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `, [startDate]);

      const scanTrends: TimeSeriesData[] = scanTrendsRaw.rows.map((row: any) => ({
        timestamp: new Date(row.date),
        value: row.count,
        label: new Date(row.date).toLocaleDateString()
      }));

      return {
        totalScans,
        scansToday: scansToday.rows[0]?.count || 0,
        scansThisWeek: scansThisWeek.rows[0]?.count || 0,
        scansThisMonth: scansThisMonth.rows[0]?.count || 0,
        scansByType,
        scansByTier,
        averageScansPerUser,
        peakUsageHours,
        scanTrends
      };
    } catch (error) {
      logger.error('[Analytics] Error getting usage analytics:', error);
      throw error;
    }
  }

  /**
   * Get revenue analytics
   */
  async getRevenueAnalytics(days: number = 30): Promise<RevenueAnalytics> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // Get all active subscriptions
      const subscriptions = await this.pool.query(`
        SELECT
          s.plan,
          s."pricePerMonth",
          s.status,
          s."startDate"
        FROM "Subscription" s
        WHERE s.status = 'active'
      `);

      // Calculate total revenue
      let totalRevenue = 0;
      let monthlyRecurringRevenue = 0;
      const revenueByPlan: Record<string, number> = {};

      subscriptions.rows.forEach((sub: any) => {
        const price = parseFloat(sub.pricePerMonth) || 0;
        monthlyRecurringRevenue += price;

        // Calculate total revenue based on subscription duration
        const monthsActive = Math.max(1, Math.floor((Date.now() - new Date(sub.startDate).getTime()) / (30 * 24 * 60 * 60 * 1000)));
        totalRevenue += price * monthsActive;

        revenueByPlan[sub.plan] = (revenueByPlan[sub.plan] || 0) + price;
      });

      const revenueByPlanArray = Object.entries(revenueByPlan).map(([plan, revenue]) => ({
        plan,
        revenue,
        percentage: (revenue / monthlyRecurringRevenue) * 100
      }));

      // Calculate metrics
      const totalUsers = await this.prisma.user.count();
      const paidUsers = subscriptions.rows.length;
      const averageRevenuePerUser = paidUsers > 0 ? monthlyRecurringRevenue / paidUsers : 0;
      const lifetimeValue = averageRevenuePerUser * 12; // Assume 12 month average lifetime
      const conversionRate = totalUsers > 0 ? (paidUsers / totalUsers) * 100 : 0;

      // Revenue growth (mock data - would be calculated from historical data)
      const revenueGrowth: TimeSeriesData[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        revenueGrowth.push({
          timestamp: date,
          value: monthlyRecurringRevenue * (0.9 + Math.random() * 0.2), // Mock growth
          label: date.toLocaleDateString()
        });
      }

      return {
        totalRevenue,
        monthlyRecurringRevenue,
        averageRevenuePerUser,
        revenueByPlan: revenueByPlanArray,
        revenueGrowth,
        lifetimeValue,
        conversionRate
      };
    } catch (error) {
      logger.error('[Analytics] Error getting revenue analytics:', error);
      throw error;
    }
  }

  /**
   * Get system analytics
   */
  async getSystemAnalytics(): Promise<SystemAnalytics> {
    try {
      // Get API usage from ApiUsage table
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const [totalRequests, requestsToday] = await Promise.all([
        this.pool.query(`SELECT COUNT(*)::int as count FROM "api_usage"`),
        this.pool.query(`SELECT COUNT(*)::int as count FROM "api_usage" WHERE timestamp >= $1`, [startOfToday])
      ]);

      // Average response time
      const avgResponseTimeResult = await this.pool.query(`
        SELECT AVG("responseTime")::int as avg FROM "api_usage"
        WHERE timestamp >= $1
      `, [startOfToday]);

      const averageResponseTime = avgResponseTimeResult.rows[0]?.avg || 0;

      // Error rate
      const [totalRequestsCount, errorRequestsCount] = await Promise.all([
        this.pool.query(`SELECT COUNT(*)::int as count FROM "api_usage" WHERE timestamp >= $1`, [startOfToday]),
        this.pool.query(`SELECT COUNT(*)::int as count FROM "api_usage" WHERE "statusCode" >= 400 AND timestamp >= $1`, [startOfToday])
      ]);

      const errorRate = totalRequestsCount.rows[0]?.count > 0
        ? (errorRequestsCount.rows[0]?.count / totalRequestsCount.rows[0]?.count) * 100
        : 0;

      // Requests by endpoint
      const requestsByEndpointRaw = await this.pool.query(`
        SELECT
          endpoint,
          COUNT(*)::int as count,
          AVG("responseTime")::int as "avgTime"
        FROM "api_usage"
        WHERE timestamp >= $1
        GROUP BY endpoint
        ORDER BY count DESC
        LIMIT 10
      `, [startOfToday]);

      const requestsByEndpoint = requestsByEndpointRaw.rows.map((row: any) => ({
        endpoint: row.endpoint,
        count: row.count,
        avgTime: row.avgTime
      }));

      // Errors by type
      const errorsByTypeRaw = await this.pool.query(`
        SELECT
          "statusCode" as type,
          COUNT(*)::int as count
        FROM "api_usage"
        WHERE "statusCode" >= 400 AND timestamp >= $1
        GROUP BY "statusCode"
        ORDER BY count DESC
      `, [startOfToday]);

      const errorsByType = errorsByTypeRaw.rows.map((row: any) => ({
        type: `HTTP ${row.type}`,
        count: row.count
      }));

      // Database size (in MB)
      const dbSizeResult = await this.pool.query(`
        SELECT pg_database_size(current_database())::bigint as size
      `);
      const databaseSize = Math.round((dbSizeResult.rows[0]?.size || 0) / 1024 / 1024);

      return {
        apiRequests: totalRequests.rows[0]?.count || 0,
        apiRequestsToday: requestsToday.rows[0]?.count || 0,
        averageResponseTime,
        errorRate,
        uptime: 99.9, // Mock - would be calculated from monitoring service
        activeConnections: 0, // Mock - would be from connection pool
        databaseSize,
        cacheHitRate: 85, // Mock - would be from Redis metrics
        requestsByEndpoint,
        errorsByType
      };
    } catch (error) {
      logger.error('[Analytics] Error getting system analytics:', error);
      throw error;
    }
  }

  /**
   * Export analytics data
   */
  async exportData(type: 'users' | 'usage' | 'revenue' | 'system', options: ExportOptions): Promise<string> {
    try {
      let data: any;

      switch (type) {
        case 'users':
          data = await this.getUserAnalytics(30);
          break;
        case 'usage':
          data = await this.getUsageAnalytics(30);
          break;
        case 'revenue':
          data = await this.getRevenueAnalytics(30);
          break;
        case 'system':
          data = await this.getSystemAnalytics();
          break;
      }

      if (options.format === 'json') {
        return JSON.stringify(data, null, 2);
      }

      if (options.format === 'csv') {
        return this.convertToCSV(data);
      }

      if (options.format === 'pdf') {
        // PDF generation would require a library like pdfkit
        // For now, return JSON
        return JSON.stringify(data, null, 2);
      }

      return JSON.stringify(data);
    } catch (error) {
      logger.error('[Analytics] Error exporting data:', error);
      throw error;
    }
  }

  /**
   * Convert object to CSV format
   */
  private convertToCSV(data: any): string {
    if (Array.isArray(data)) {
      if (data.length === 0) return '';

      const headers = Object.keys(data[0]);
      const rows = data.map(row =>
        headers.map(header => {
          const value = row[header];
          if (typeof value === 'object') return JSON.stringify(value);
          return value;
        }).join(',')
      );

      return [headers.join(','), ...rows].join('\n');
    }

    // For objects, flatten them
    const lines: string[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value)) {
        lines.push(`${key}`);
        lines.push(this.convertToCSV(value));
      } else if (typeof value === 'object') {
        lines.push(`${key},${JSON.stringify(value)}`);
      } else {
        lines.push(`${key},${value}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Get real-time metrics (for WebSocket streaming)
   */
  async getRealtimeMetrics(): Promise<any> {
    try {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      const [activeUsers, recentScans, recentErrors] = await Promise.all([
        this.pool.query(`
          SELECT COUNT(DISTINCT "userId")::int as count
          FROM "api_usage"
          WHERE timestamp >= $1
        `, [fiveMinutesAgo]),
        this.pool.query(`
          SELECT COUNT(*)::int as count
          FROM "ScanHistory"
          WHERE "createdAt" >= $1
        `, [fiveMinutesAgo]),
        this.pool.query(`
          SELECT COUNT(*)::int as count
          FROM "api_usage"
          WHERE timestamp >= $1 AND "statusCode" >= 400
        `, [fiveMinutesAgo])
      ]);

      return {
        timestamp: now,
        activeUsers: activeUsers.rows[0]?.count || 0,
        recentScans: recentScans.rows[0]?.count || 0,
        recentErrors: recentErrors.rows[0]?.count || 0,
        systemStatus: 'healthy'
      };
    } catch (error) {
      logger.error('[Analytics] Error getting realtime metrics:', error);
      return {
        timestamp: new Date(),
        activeUsers: 0,
        recentScans: 0,
        recentErrors: 0,
        systemStatus: 'error'
      };
    }
  }
}

export const analyticsService = new AnalyticsService();
