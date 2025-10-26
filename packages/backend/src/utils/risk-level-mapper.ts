/**
 * Risk Level Mapper Utility
 *
 * Maps V2 Scanner's letter-grade RiskLevel (A-F) to Prisma's enum values
 * (safe, low, medium, high, critical)
 */

/**
 * Prisma RiskLevel enum values
 */
type PrismaRiskLevel = 'safe' | 'low' | 'medium' | 'high' | 'critical';

/**
 * V2 Scanner RiskLevel enum values (letter grades)
 */
type V2RiskLevel = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

/**
 * Map V2 Scanner's letter grade to Prisma's enum value
 *
 * Mapping:
 * - A (Safe 0-15%) → safe
 * - B (Low 15-30%) → low
 * - C (Medium 30-50%) → medium
 * - D (High 50-75%) → high
 * - E (Critical 75-90%) → critical
 * - F (Severe 90-100%) → critical
 */
export function mapV2RiskLevelToPrisma(v2RiskLevel: string): PrismaRiskLevel {
  switch (v2RiskLevel) {
    case 'A':
      return 'safe';
    case 'B':
      return 'low';
    case 'C':
      return 'medium';
    case 'D':
      return 'high';
    case 'E':
    case 'F':
      return 'critical';
    default:
      // Fallback: try to parse as Prisma enum value
      const lowerCase = v2RiskLevel.toLowerCase();
      if (['safe', 'low', 'medium', 'high', 'critical'].includes(lowerCase)) {
        return lowerCase as PrismaRiskLevel;
      }
      // Default to medium for unknown values
      console.warn(`Unknown risk level: ${v2RiskLevel}, defaulting to medium`);
      return 'medium';
  }
}

/**
 * Map Prisma's enum value to V2 Scanner's letter grade
 * (For reverse mapping if needed)
 */
export function mapPrismaRiskLevelToV2(prismaRiskLevel: string): V2RiskLevel {
  switch (prismaRiskLevel.toLowerCase()) {
    case 'safe':
      return 'A';
    case 'low':
      return 'B';
    case 'medium':
      return 'C';
    case 'high':
      return 'D';
    case 'critical':
      return 'E';
    default:
      console.warn(`Unknown Prisma risk level: ${prismaRiskLevel}, defaulting to C`);
      return 'C';
  }
}
