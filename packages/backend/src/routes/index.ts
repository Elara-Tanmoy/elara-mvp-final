import express from 'express';
import { logger } from '../config/logger.js';
import { authController } from '../controllers/auth.controller.js';
import { scanController } from '../controllers/scan.controller.js';
import { datasetController } from '../controllers/dataset.controller.js';
import { aiController } from '../controllers/ai.controller.js';
import { adminController } from '../controllers/admin.controller.js';
import { profileController } from '../controllers/profile.controller.js';
import { factController } from '../controllers/fact.controller.js';
import { literacyController } from '../controllers/literacy.controller.js';
import { recoveryController } from '../controllers/recovery.controller.js';
import { chatbotController } from '../controllers/chatbot.controller.js';
import { authenticate, requireAdmin } from '../middleware/auth.middleware.js';
import { createTierBasedRateLimiter, globalRateLimiter } from '../middleware/rateLimiter.middleware.js';
import proxyRoutes from './proxy.routes.js';
import graphRoutes from './graph.routes.js';
import deepfakeRoutes from './deepfake.routes.js';
import behaviorRoutes from './behavior.routes.js';
import blockchainRoutes from './blockchain.routes.js';
import federatedLearningRoutes from './federatedLearning.routes.js';
import intelligenceRoutes from './intelligence.routes.js';
import scanAnalyticsRoutes from './scanAnalytics.routes.js';
import threatIntelRoutes from './threatIntel.routes.js';
import oauthRoutes from './oauth.routes.js';
import adminScanEngineRoutes from './admin.routes.js';
import messageScanAdminRoutes from './message-scan-admin.routes.js';
import globalSettingsRoutes from './admin/globalSettings.routes.js';
import { whatsappWebhookController } from '../controllers/whatsapp-webhook.controller.js';
import { whatsappAdminController } from '../controllers/whatsapp-admin.controller.js';

const router: any = express.Router();
const rateLimiter = createTierBasedRateLimiter();

// Health check
router.get('/health', async (req, res) => {
  try {
    // Check database connection
    let dbStatus = 'disconnected';
    try {
      const { prisma } = await import('../config/database.js');
      await prisma.$queryRaw`SELECT 1`;
      await prisma.$disconnect();
    } catch (error) {
      dbStatus = 'disconnected';
    }

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      services: {
        redis: process.env.REDIS_HOST ? 'configured' : 'mock',
        chromadb: process.env.CHROMADB_URL ? 'configured' : 'mock'
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      database: 'disconnected'
    });
  }
});

// Auth routes (v2)
router.post('/v2/auth/register', authController.register.bind(authController));
router.post('/v2/auth/login', authController.login.bind(authController));
router.post('/v2/auth/refresh', authController.refreshToken.bind(authController));
router.post('/v2/auth/logout', authController.logout.bind(authController));
router.get('/v2/auth/me', authenticate, authController.getCurrentUser.bind(authController));

// OAuth SSO routes (v2) - Social authentication
logger.info('[Routes] Registering OAuth routes at /v2/auth...');
router.use('/v2/auth', oauthRoutes);
logger.info('[Routes] OAuth routes registered. Testing route stack...');

// Scan routes (v2) - Protected
router.post('/v2/scan/url', authenticate, rateLimiter, scanController.scanURL.bind(scanController));
router.post('/v2/scan/message', authenticate, rateLimiter, scanController.scanMessage.bind(scanController));
router.post('/v2/scan/file', authenticate, rateLimiter, scanController.scanFile.bind(scanController));
router.post('/v2/scan/pre-browse', authenticate, rateLimiter, scanController.preBrowseScan.bind(scanController)); // Fast pre-browse scan for Secure Browser
router.get('/v2/scans', authenticate, scanController.getScans.bind(scanController));
router.get('/v2/scans/:id', authenticate, scanController.getScan.bind(scanController));

// Dataset routes (v2) - Protected, Admin only
router.post('/v2/datasets', authenticate, requireAdmin, datasetController.uploadDataset.bind(datasetController));
router.get('/v2/datasets', authenticate, requireAdmin, datasetController.getDatasets.bind(datasetController));
router.get('/v2/datasets/:id', authenticate, requireAdmin, datasetController.getDataset.bind(datasetController));
router.delete('/v2/datasets/:id', authenticate, requireAdmin, datasetController.deleteDataset.bind(datasetController));

// AI routes (v2) - Protected
router.post('/v2/ai/query', authenticate, rateLimiter, aiController.query.bind(aiController));

// Profile Analyzer routes (v2) - Protected
router.post('/v2/analyze/profile', authenticate, rateLimiter, profileController.analyzeProfile.bind(profileController));
router.get('/v2/analyze/profile/platforms', authenticate, profileController.getSupportedPlatforms.bind(profileController));

// Fact Checker routes (v2) - Protected
router.post('/v2/analyze/fact', authenticate, rateLimiter, factController.checkFact.bind(factController));
router.post('/v2/analyze/fact/extract-claims', authenticate, rateLimiter, factController.extractClaims.bind(factController));
router.get('/v2/analyze/fact/stats', authenticate, factController.getFactCheckStats.bind(factController));
router.get('/v2/analyze/fact/categories', authenticate, factController.getSupportedCategories.bind(factController));

// Digital Literacy Coach routes (v2) - Protected
router.get('/v2/literacy/quiz', authenticate, literacyController.getQuiz.bind(literacyController));
router.post('/v2/literacy/quiz/submit', authenticate, literacyController.submitQuiz.bind(literacyController));
router.get('/v2/literacy/lessons', authenticate, literacyController.getLessons.bind(literacyController));
router.get('/v2/literacy/lessons/:lessonId', authenticate, literacyController.getLesson.bind(literacyController));
router.get('/v2/literacy/exercise/:lessonId', authenticate, literacyController.getExercise.bind(literacyController));
router.post('/v2/literacy/exercise/submit', authenticate, literacyController.submitExercise.bind(literacyController));
router.post('/v2/literacy/progress', authenticate, literacyController.trackProgress.bind(literacyController));
router.get('/v2/literacy/progress', authenticate, literacyController.getProgress.bind(literacyController));
router.get('/v2/literacy/stats', authenticate, literacyController.getStats.bind(literacyController));
router.get('/v2/literacy/recommendations', authenticate, literacyController.getRecommendations.bind(literacyController));

// Recovery Support routes (v2) - Protected
router.post('/v2/recovery/incident', authenticate, rateLimiter, recoveryController.reportIncident.bind(recoveryController));
router.get('/v2/recovery/resources', authenticate, recoveryController.getResources.bind(recoveryController));
router.get('/v2/recovery/resources/:resourceId', authenticate, recoveryController.getResource.bind(recoveryController));
router.post('/v2/recovery/followup', authenticate, recoveryController.recordFollowUp.bind(recoveryController));
router.get('/v2/recovery/incidents', authenticate, recoveryController.getIncidents.bind(recoveryController));
router.get('/v2/recovery/stats', authenticate, recoveryController.getStats.bind(recoveryController));
router.get('/v2/recovery/crisis', recoveryController.getCrisisHotlines.bind(recoveryController)); // Public access for crisis hotlines
router.get('/v2/recovery/stories', authenticate, recoveryController.getSuccessStories.bind(recoveryController));

// Admin routes (v2) - Protected, Admin only
// Dashboard
router.get('/v2/admin/dashboard/stats', authenticate, requireAdmin, adminController.getDashboardStats.bind(adminController));

// User Management
router.get('/v2/admin/users', authenticate, requireAdmin, adminController.getAllUsers.bind(adminController));
router.patch('/v2/admin/users/:userId/role', authenticate, requireAdmin, adminController.updateUserRole.bind(adminController));
router.patch('/v2/admin/users/:userId/tier', authenticate, requireAdmin, adminController.changeUserTier.bind(adminController));
router.patch('/v2/admin/users/:userId/toggle-status', authenticate, requireAdmin, adminController.toggleUserStatus.bind(adminController));
router.delete('/v2/admin/users/:userId', authenticate, requireAdmin, adminController.deleteUser.bind(adminController));

// System Settings
router.get('/v2/admin/settings', authenticate, requireAdmin, adminController.getSystemSettings.bind(adminController));
router.post('/v2/admin/settings', authenticate, requireAdmin, adminController.createSystemSetting.bind(adminController));
router.put('/v2/admin/settings', authenticate, requireAdmin, adminController.updateSystemSetting.bind(adminController));

// Rate Limiting
router.get('/v2/admin/rate-limits', authenticate, requireAdmin, adminController.getRateLimitConfigs.bind(adminController));
router.put('/v2/admin/rate-limits/:tier', authenticate, requireAdmin, adminController.updateRateLimitConfig.bind(adminController));

// Subscriptions
router.get('/v2/admin/subscriptions', authenticate, requireAdmin, adminController.getAllSubscriptions.bind(adminController));
router.patch('/v2/admin/subscriptions/:subscriptionId', authenticate, requireAdmin, adminController.updateSubscription.bind(adminController));

// Integrations
router.get('/v2/admin/integrations', authenticate, requireAdmin, adminController.getIntegrations.bind(adminController));
router.post('/v2/admin/integrations', authenticate, requireAdmin, adminController.createIntegration.bind(adminController));
router.patch('/v2/admin/integrations/:integrationId', authenticate, requireAdmin, adminController.updateIntegration.bind(adminController));

// Analytics
router.get('/v2/admin/analytics/api-usage', authenticate, requireAdmin, adminController.getApiUsageStats.bind(adminController));
router.get('/v2/admin/analytics/activity-logs', authenticate, requireAdmin, adminController.getAdminActivityLogs.bind(adminController));

// Advanced Analytics
router.get('/v2/admin/analytics/users', authenticate, requireAdmin, adminController.getUserAnalytics.bind(adminController));
router.get('/v2/admin/analytics/usage', authenticate, requireAdmin, adminController.getUsageAnalytics.bind(adminController));
router.get('/v2/admin/analytics/revenue', authenticate, requireAdmin, adminController.getRevenueAnalytics.bind(adminController));
router.get('/v2/admin/analytics/system', authenticate, requireAdmin, adminController.getSystemAnalytics.bind(adminController));
router.get('/v2/admin/analytics/realtime', authenticate, requireAdmin, adminController.getRealtimeMetrics.bind(adminController));
router.get('/v2/admin/analytics/export', authenticate, requireAdmin, adminController.exportAnalytics.bind(adminController));

// API Key Management
router.post('/v2/admin/api-keys', authenticate, requireAdmin, adminController.generateApiKey.bind(adminController));
router.get('/v2/admin/api-keys', authenticate, requireAdmin, adminController.listApiKeys.bind(adminController));
router.delete('/v2/admin/api-keys/:keyId', authenticate, requireAdmin, adminController.revokeApiKey.bind(adminController));
router.get('/v2/admin/api-keys/:keyId/usage', authenticate, requireAdmin, adminController.getApiKeyUsage.bind(adminController));

// Webhook Management
router.post('/v2/admin/webhooks', authenticate, requireAdmin, adminController.createWebhook.bind(adminController));
router.get('/v2/admin/webhooks', authenticate, requireAdmin, adminController.listWebhooks.bind(adminController));
router.delete('/v2/admin/webhooks/:webhookId', authenticate, requireAdmin, adminController.deleteWebhook.bind(adminController));
router.post('/v2/admin/webhooks/:webhookId/test', authenticate, requireAdmin, adminController.testWebhook.bind(adminController));

// Knowledge Base Management - Threat Intelligence Integration
router.post('/v2/admin/knowledge/populate/threats', authenticate, requireAdmin, adminController.populateKnowledgeFromThreats.bind(adminController));
router.post('/v2/admin/knowledge/populate/threats/recent', authenticate, requireAdmin, adminController.populateKnowledgeRecentThreats.bind(adminController));
router.post('/v2/admin/knowledge/populate/threats/high-severity', authenticate, requireAdmin, adminController.populateKnowledgeHighSeverityThreats.bind(adminController));
router.get('/v2/admin/knowledge/populate/stats', authenticate, requireAdmin, adminController.getKnowledgePopulationStats.bind(adminController));
router.delete('/v2/admin/knowledge/threats', authenticate, requireAdmin, adminController.clearThreatIntelKnowledge.bind(adminController));

// WhatsApp User Management - Admin only
router.get('/v2/admin/whatsapp/users', authenticate, requireAdmin, whatsappAdminController.getAllUsers.bind(whatsappAdminController));
router.patch('/v2/admin/whatsapp/users/:phoneNumber/tier', authenticate, requireAdmin, whatsappAdminController.upgradeUserTier.bind(whatsappAdminController));
router.post('/v2/admin/whatsapp/users/:phoneNumber/reset', authenticate, requireAdmin, whatsappAdminController.resetUserCounter.bind(whatsappAdminController));
router.get('/v2/admin/whatsapp/stats', authenticate, requireAdmin, whatsappAdminController.getStats.bind(whatsappAdminController));
router.post('/v2/admin/whatsapp/bulk-upgrade', authenticate, requireAdmin, whatsappAdminController.bulkUpgrade.bind(whatsappAdminController));

// WhatsApp Message Management - Admin only (NEW)
router.get('/v2/admin/whatsapp/messages', authenticate, requireAdmin, whatsappAdminController.getAllMessages.bind(whatsappAdminController));
router.get('/v2/admin/whatsapp/messages/:messageId', authenticate, requireAdmin, whatsappAdminController.getMessageDetails.bind(whatsappAdminController));

// WhatsApp Media Management - Admin only (NEW)
router.get('/v2/admin/whatsapp/media/:mediaId/download', authenticate, requireAdmin, whatsappAdminController.downloadMedia.bind(whatsappAdminController));
router.get('/v2/admin/whatsapp/media/:mediaId/thumbnail', authenticate, requireAdmin, whatsappAdminController.getMediaThumbnail.bind(whatsappAdminController));

// Ask Elara Chatbot routes (v2) - Public chat, Admin for config/training
router.post('/v2/chatbot/chat', globalRateLimiter, chatbotController.chat.bind(chatbotController)); // Public access - uses IP-based rate limiting
router.get('/v2/chatbot/session/:id', chatbotController.getSession.bind(chatbotController));
router.post('/v2/chatbot/session/end', chatbotController.endSession.bind(chatbotController));
router.get('/v2/chatbot/config', chatbotController.getConfig.bind(chatbotController)); // Public can read config
router.put('/v2/chatbot/config', authenticate, requireAdmin, chatbotController.updateConfig.bind(chatbotController)); // Admin only
router.post('/v2/chatbot/knowledge', authenticate, requireAdmin, chatbotController.addKnowledge.bind(chatbotController)); // Admin only
router.get('/v2/chatbot/knowledge/search', chatbotController.searchKnowledge.bind(chatbotController)); // Public
router.get('/v2/chatbot/knowledge/stats', chatbotController.getKnowledgeStats.bind(chatbotController)); // Public
router.delete('/v2/chatbot/knowledge/:id', authenticate, requireAdmin, chatbotController.deleteKnowledge.bind(chatbotController)); // Admin only
router.post('/v2/chatbot/training/csv', authenticate, requireAdmin, chatbotController.uploadCSV.bind(chatbotController)); // Admin only
router.post('/v2/chatbot/training/text', authenticate, requireAdmin, chatbotController.uploadText.bind(chatbotController)); // Admin only
router.post('/v2/chatbot/training/json', authenticate, requireAdmin, chatbotController.uploadJSON.bind(chatbotController)); // Admin only
router.get('/v2/chatbot/training/:id', authenticate, requireAdmin, chatbotController.getTrainingStatus.bind(chatbotController)); // Admin only
router.get('/v2/chatbot/training/history', authenticate, requireAdmin, chatbotController.getTrainingHistory.bind(chatbotController)); // Admin only
router.get('/v2/chatbot/analytics', authenticate, requireAdmin, chatbotController.getAnalytics.bind(chatbotController)); // Admin only

// Trust Graph routes (v2) - Protected (PHASE 1 ENHANCEMENT)
router.use('/v2/graph', authenticate, graphRoutes);

// Deepfake & AI Content Detection routes (v2) - Protected (PHASE 2 ENHANCEMENT)
router.use('/v2/ai', authenticate, deepfakeRoutes);

// Behavioral Biometrics routes (v2) - Protected (PHASE 2 ENHANCEMENT)
router.use('/v2/behavior', authenticate, behaviorRoutes);

// Blockchain-Based Scam Reporting routes (v2) - Public + Authenticated (PHASE 3 ENHANCEMENT)
router.use('/v2/blockchain', authenticate, blockchainRoutes);

// Federated Learning routes (v2) - Public (privacy-preserving) (PHASE 3 ENHANCEMENT)
router.use('/v2/federated', federatedLearningRoutes);

// SecureVPN Proxy routes (v2) - Protected, Premium feature
router.use('/v2/proxy', proxyRoutes);

// Data Intelligence routes (v2) - Admin only (for LLM training and analytics)
router.use('/v2/intelligence', intelligenceRoutes);

// Scan Analytics routes (v2) - Admin only (for scan data analytics and visualization)
router.use('/v2/analytics/scans', scanAnalyticsRoutes);

// Threat Intelligence routes (v2) - Admin only (for threat feed management)
router.use('/v2/threat-intel', threatIntelRoutes);

// ═══════════════════════════════════════════════════════════════════════════
// SCAN ENGINE ADMIN ROUTES - Admin Panel (Phases 7-8)
// ═══════════════════════════════════════════════════════════════════════════
// Scan Engine Admin Panel - Admin only (for scan engine management)
logger.info('[Routes] Registering Scan Engine Admin routes at /v2/admin/scan-engine...');
router.use('/v2/admin/scan-engine', authenticate, requireAdmin, adminScanEngineRoutes);
logger.info('[Routes] Scan Engine Admin routes registered');

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGE SCAN ADMIN ROUTES - Admin Panel
// ═══════════════════════════════════════════════════════════════════════════
// Message Scan Admin Panel - Admin only (for message scan configuration management)
logger.info('[Routes] Registering Message Scan Admin routes at /v2/admin/message-scan...');
router.use('/v2/admin/message-scan', authenticate, requireAdmin, messageScanAdminRoutes);
logger.info('[Routes] Message Scan Admin routes registered');

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL SETTINGS ADMIN ROUTES - Admin Panel
// ═══════════════════════════════════════════════════════════════════════════
// Global Settings Admin Panel - Admin only (for global configuration management)
logger.info('[Routes] Registering Global Settings Admin routes at /v2/admin/global-settings...');
router.use('/v2/admin/global-settings', authenticate, requireAdmin, globalSettingsRoutes);
logger.info('[Routes] Global Settings Admin routes registered');

// ═══════════════════════════════════════════════════════════════════════════
// WHATSAPP WEBHOOK ROUTES - NEW
// ═══════════════════════════════════════════════════════════════════════════
// WhatsApp webhook endpoint - Public (Twilio webhooks)
logger.info('[Routes] Registering WhatsApp webhook routes...');
router.post('/webhook/whatsapp', whatsappWebhookController.handleIncomingMessage.bind(whatsappWebhookController));
router.get('/webhook/whatsapp/health', whatsappWebhookController.healthCheck.bind(whatsappWebhookController));
router.get('/webhook/whatsapp/status', whatsappWebhookController.getStatus.bind(whatsappWebhookController));
logger.info('[Routes] WhatsApp webhook routes registered at /webhook/whatsapp');

export default router;
