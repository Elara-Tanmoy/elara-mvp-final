// Shared TypeScript types for Elara Platform

export enum OrganizationTier {
  FREE = 'free',
  PRO = 'pro',
  ENTERPRISE = 'enterprise'
}

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  OWNER = 'owner'
}

export enum ScanType {
  URL = 'url',
  MESSAGE = 'message',
  FILE = 'file'
}

export enum RiskLevel {
  SAFE = 'safe',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ScanStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  organizationId: string;
  isActive: boolean;
  createdAt: Date;
}

export interface Organization {
  id: string;
  name: string;
  tier: OrganizationTier;
  apiKey: string;
  isActive: boolean;
  createdAt: Date;
}

export interface ScanResult {
  id: string;
  scanType: ScanType;
  url?: string;
  content?: string;
  fileName?: string;
  riskScore: number;
  riskLevel: RiskLevel;
  status: ScanStatus;
  findings: Finding[];
  aiAnalysis?: any;
  createdAt: Date;
}

export interface Finding {
  type: string;
  severity: string;
  message: string;
  points: number;
  details?: any;
}

export interface RiskCategory {
  category: string;
  score: number;
  maxWeight: number;
  findings: Finding[];
  evidence?: any;
}

export const CATEGORY_WEIGHTS = {
  'Domain Analysis': 40,
  'SSL/TLS Analysis': 45,
  'Threat Intelligence': 50,
  'Content Analysis': 40,
  'Phishing Patterns': 50,
  'Malware Detection': 45,
  'Behavioral Analysis': 25,
  'Social Engineering': 30,
  'Financial Fraud': 25,
  'Identity Theft': 20,
  'Technical Exploits': 15,
  'Brand Impersonation': 20,
  'Network Analysis': 15
};

export const TOTAL_RISK_SCORE = 350;
