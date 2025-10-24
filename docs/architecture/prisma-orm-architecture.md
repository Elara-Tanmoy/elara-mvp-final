# Elara Platform - Prisma ORM End-to-End Architecture

**Document Version**: 1.0
**Last Updated**: 2025-10-24
**Author**: Solution Architect (Claude Code)
**Status**: Production
**Classification**: Technical Documentation

---

## Table of Contents

1. [Overview](#overview)
2. [Prisma Client Architecture](#prisma-client-architecture)
3. [Database Configuration](#database-configuration)
4. [Connection Pooling](#connection-pooling)
5. [Query Patterns](#query-patterns)
6. [CRUD Operations](#crud-operations)
7. [Relationships & Joins](#relationships--joins)
8. [Transaction Handling](#transaction-handling)
9. [Migration Strategy](#migration-strategy)
10. [Performance Optimization](#performance-optimization)
11. [Error Handling](#error-handling)
12. [Best Practices](#best-practices)
13. [Production Metrics](#production-metrics)

---

## Overview

Elara uses **Prisma ORM 5.22.0** as the primary data access layer for PostgreSQL 15. This document provides comprehensive end-to-end architecture details for Prisma usage across the platform.

### Key Technologies

| Component | Version | Purpose |
|-----------|---------|---------|
| **Prisma Client** | 5.22.0 | Type-safe database client |
| **PostgreSQL** | 15 | Primary database |
| **Database** | elara-postgres-optimized | Cloud SQL instance |
| **Schema Models** | 45 models | Complete data model |
| **Schema LOC** | 1,669 lines | Total schema definition |
| **Node.js** | 20.x | Runtime environment |

### Database Endpoints

```typescript
// Production Database
DATABASE_URL="postgresql://elara:***@10.190.1.11:5432/elara_production"

// Development Database
DATABASE_URL="postgresql://elara:***@10.190.1.11:5432/elara_dev"

// Staging Database (Dormant - No K8s Deployment)
STAGING_DATABASE_URL="postgresql://elara:***@10.190.1.11:5432/elara_staging"

// Threat Intelligence Database (Shared)
// Used by all environments for 200K+ threat indicators
// Connected via same URL with different database name
```

---

## Prisma Client Architecture

### Singleton Pattern Implementation

**File**: `packages/backend/src/config/database.ts`

Elara implements Prisma client as a singleton to ensure:
- Single connection pool per Node.js process
- No connection leaks
- Optimal resource utilization
- Hot reload support in development

```typescript
import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

// Singleton factory for primary database
const prismaClientSingleton = () => {
  return new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'event' },
      { level: 'warn', emit: 'event' },
    ],
  });
};

// Singleton factory for staging database
const prismaStagingClientSingleton = () => {
  if (!process.env.STAGING_DATABASE_URL) {
    return null;
  }
  return new PrismaClient({
    datasources: {
      db: {
        url: process.env.STAGING_DATABASE_URL
      }
    },
    log: [
      { level: 'error', emit: 'event' },
      { level: 'warn', emit: 'event' },
    ],
  });
};

// Global type declarations for HMR support
declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
  var prismaStagingGlobal: undefined | ReturnType<typeof prismaStagingClientSingleton>;
}

// Export singleton instances
export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();
export const prismaStaging = globalThis.prismaStagingGlobal ?? prismaStagingClientSingleton();

// Development mode: Preserve client instance during hot reload
if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
  globalThis.prismaStagingGlobal = prismaStaging;
}
```

### Event Logging Configuration

```typescript
// Query logging - ENABLED FOR DEBUGGING (previously dev-only)
prisma.$on('query' as never, (e: any) => {
  logger.debug(`[Prisma] Query: ${e.query}`);
  logger.debug(`[Prisma] Params: ${JSON.stringify(e.params)}`);
  logger.debug(`[Prisma] Duration: ${e.duration}ms`);
});

// Error logging
prisma.$on('error' as never, (e: any) => {
  logger.error('Database error:', e);
});

// Warning logging
prisma.$on('warn' as never, (e: any) => {
  logger.warn('Database warning:', e);
});

// Staging client logging
if (prismaStaging) {
  prismaStaging.$on('error' as never, (e: any) => {
    logger.error('[Staging DB] Database error:', e);
  });

  prismaStaging.$on('warn' as never, (e: any) => {
    logger.warn('[Staging DB] Database warning:', e);
  });
}
```

### Import Pattern

Throughout the codebase, Prisma is imported consistently:

```typescript
// Standard import
import { prisma } from '../config/database.js';

// With staging database
import { prisma, prismaStaging } from '../config/database.js';

// Usage in services/controllers
export class AuthController {
  async register(req: Request, res: Response) {
    const user = await prisma.user.create({
      data: { /* ... */ }
    });
  }
}
```

---

## Database Configuration

### Environment Variables

**Required Configuration**:

```bash
# Primary Database URL (Production/Development)
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"

# Example Production
DATABASE_URL="postgresql://elara:***@10.190.1.11:5432/elara_production"

# Staging Database URL (Optional)
STAGING_DATABASE_URL="postgresql://elara:***@10.190.1.11:5432/elara_staging"

# Connection Pool Settings
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
DATABASE_POOL_TIMEOUT=30000  # 30 seconds

# Query Timeouts
DATABASE_QUERY_TIMEOUT=10000  # 10 seconds
```

### schema.prisma Configuration

**File**: `packages/backend/prisma/schema.prisma`

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["fullTextSearch", "postgresqlExtensions"]
  binaryTargets   = ["native", "linux-musl-openssl-3.0.x"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pgcrypto]
}

// 45 model definitions follow...
```

**Key Configuration Options**:

1. **Preview Features**:
   - `fullTextSearch`: Enables PostgreSQL full-text search capabilities
   - `postgresqlExtensions`: Allows use of PostgreSQL extensions (pgcrypto)

2. **Binary Targets**:
   - `native`: For local development (Windows/macOS)
   - `linux-musl-openssl-3.0.x`: For Alpine-based Docker containers in GKE

3. **Extensions**:
   - `pgcrypto`: For cryptographic functions (UUID generation, hashing)

---

## Connection Pooling

### Default Pool Configuration

Prisma Client uses PostgreSQL connection pooling internally:

```typescript
// Implicit configuration via Prisma Client
// Default pool size: 10 connections per Node.js process

// Can be configured via DATABASE_URL
// Example with explicit pool settings:
DATABASE_URL="postgresql://user:password@host:5432/db?connection_limit=10&pool_timeout=20"
```

### GKE Pod Configuration

**Production Deployment**:
- 3 backend pods (elara-backend)
- 3 worker pods (elara-workers)
- Total: ~60 connections (6 pods × 10 connections each)

**Cloud SQL Configuration**:
- Instance: elara-postgres-optimized
- Max connections: 100
- Reserved for Cloud SQL: 3
- Available: 97 connections
- Current usage: ~60-70 connections (60-72% utilization)

### Connection Pool Best Practices

```typescript
// ✅ CORRECT: Reuse Prisma client instance
import { prisma } from '../config/database.js';

export async function getUser(id: string) {
  return await prisma.user.findUnique({ where: { id } });
}

// ❌ INCORRECT: Creating new Prisma client instances
export async function getUser(id: string) {
  const prisma = new PrismaClient(); // DON'T DO THIS!
  return await prisma.user.findUnique({ where: { id } });
}
```

### Connection Lifecycle Management

```typescript
// Graceful shutdown handler
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing database connections...');

  await prisma.$disconnect();

  if (prismaStaging) {
    await prismaStaging.$disconnect();
  }

  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing database connections...');

  await prisma.$disconnect();

  if (prismaStaging) {
    await prismaStaging.$disconnect();
  }

  process.exit(0);
});
```

---

## Query Patterns

### 1. Simple Queries

#### Find Unique

```typescript
// Find user by ID
const user = await prisma.user.findUnique({
  where: { id: userId }
});

// Find user by email (unique constraint)
const user = await prisma.user.findUnique({
  where: { email: 'user@example.com' }
});

// Find organization by API key
const org = await prisma.organization.findUnique({
  where: { apiKey: 'elara_abc123xyz' }
});
```

#### Find First

```typescript
// Find first matching scan result
const scanResult = await prisma.scanResult.findFirst({
  where: {
    userId: userId,
    status: 'completed'
  },
  orderBy: {
    createdAt: 'desc'
  }
});
```

#### Find Many

```typescript
// Find all users in organization
const users = await prisma.user.findMany({
  where: {
    organizationId: orgId,
    isActive: true
  },
  orderBy: {
    createdAt: 'desc'
  },
  take: 20,
  skip: 0
});

// Count query
const totalUsers = await prisma.user.count({
  where: {
    organizationId: orgId,
    isActive: true
  }
});
```

### 2. Complex Filters

```typescript
// Multiple conditions with AND
const scanResults = await prisma.scanResult.findMany({
  where: {
    AND: [
      { organizationId: orgId },
      { status: 'completed' },
      { riskLevel: { in: ['high', 'critical'] } },
      { createdAt: { gte: new Date('2025-10-01') } }
    ]
  }
});

// OR conditions
const users = await prisma.user.findMany({
  where: {
    OR: [
      { role: 'owner' },
      { role: 'admin' }
    ],
    organizationId: orgId
  }
});

// NOT conditions
const activeScans = await prisma.scanResult.findMany({
  where: {
    NOT: {
      status: { in: ['failed', 'cancelled'] }
    }
  }
});
```

### 3. Text Search

```typescript
// Case-insensitive search
const users = await prisma.user.findMany({
  where: {
    email: {
      contains: 'example',
      mode: 'insensitive'
    }
  }
});

// Starts with pattern
const organizations = await prisma.organization.findMany({
  where: {
    name: {
      startsWith: 'Acme',
      mode: 'insensitive'
    }
  }
});
```

### 4. Aggregations

```typescript
// Count by group
const scansByType = await prisma.scanResult.groupBy({
  by: ['scanType'],
  _count: {
    id: true
  },
  where: {
    organizationId: orgId,
    createdAt: {
      gte: new Date('2025-10-01')
    }
  }
});

// Sum aggregation
const totalApiCalls = await prisma.apiLog.aggregate({
  _sum: {
    requestCount: true
  },
  where: {
    organizationId: orgId,
    timestamp: {
      gte: startDate,
      lte: endDate
    }
  }
});

// Average score
const avgScore = await prisma.scanResult.aggregate({
  _avg: {
    riskScore: true
  },
  where: {
    organizationId: orgId,
    status: 'completed'
  }
});
```

---

## CRUD Operations

### Create Operations

#### Simple Create

**Example**: User Registration

**File**: `packages/backend/src/controllers/auth.controller.ts:36-56`

```typescript
// Create organization
const organization = await prisma.organization.create({
  data: {
    name: validatedData.organizationName,
    tier: 'free',
    apiKey: generateApiKey(),
    apiSecret: await hashPassword(generateApiSecret())
  }
});

// Create user
const hashedPassword = await hashPassword(validatedData.password);

const user = await prisma.user.create({
  data: {
    email: validatedData.email,
    passwordHash: hashedPassword,
    firstName: validatedData.firstName,
    lastName: validatedData.lastName,
    role: 'owner',
    organizationId: organization.id
  }
});
```

#### Create with Nested Relations

```typescript
// Create organization with owner user in single query
const organization = await prisma.organization.create({
  data: {
    name: 'Acme Corp',
    tier: 'premium',
    apiKey: generateApiKey(),
    apiSecret: await hashPassword(generateApiSecret()),
    users: {
      create: {
        email: 'owner@acme.com',
        passwordHash: await hashPassword('password'),
        firstName: 'John',
        lastName: 'Doe',
        role: 'owner'
      }
    }
  },
  include: {
    users: true
  }
});
```

#### Create Many (Bulk Insert)

```typescript
// Bulk insert threat indicators
const indicators = await prisma.threatIndicator.createMany({
  data: [
    {
      type: 'url',
      value: 'https://malicious.com',
      threatType: 'phishing',
      severity: 'high',
      confidence: 95,
      sourceId: 'phishtank'
    },
    {
      type: 'url',
      value: 'https://malware.net',
      threatType: 'malware',
      severity: 'critical',
      confidence: 90,
      sourceId: 'urlhaus'
    }
    // ... more indicators
  ],
  skipDuplicates: true // Skip records that violate unique constraints
});

console.log(`Inserted ${indicators.count} indicators`);
```

### Read Operations

#### Select Specific Fields

```typescript
// Select only needed fields (performance optimization)
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    role: true
  }
});

// Without password hash
const publicUser = await prisma.user.findUnique({
  where: { id: userId },
  select: {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    role: true,
    createdAt: true,
    organization: {
      select: {
        id: true,
        name: true,
        tier: true
      }
    }
  }
});
```

#### Include Relations

```typescript
// Include related data
const scanResult = await prisma.scanResult.findUnique({
  where: { id: scanId },
  include: {
    user: {
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true
      }
    },
    organization: {
      select: {
        id: true,
        name: true,
        tier: true
      }
    },
    riskCategories: true,
    threatIntelMatches: {
      include: {
        indicator: {
          select: {
            type: true,
            value: true,
            threatType: true,
            severity: true
          }
        }
      }
    }
  }
});
```

#### Pagination

```typescript
// Standard pagination pattern
async function getPaginatedScans(
  organizationId: string,
  page: number = 1,
  limit: number = 20
) {
  const skip = (page - 1) * limit;

  const [scans, total] = await Promise.all([
    prisma.scanResult.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    }),
    prisma.scanResult.count({
      where: { organizationId }
    })
  ]);

  return {
    data: scans,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}
```

### Update Operations

#### Simple Update

```typescript
// Update user profile
const updatedUser = await prisma.user.update({
  where: { id: userId },
  data: {
    firstName: 'John',
    lastName: 'Smith',
    profilePicture: 'https://cdn.example.com/avatar.jpg',
    updatedAt: new Date()
  }
});

// Update scan status
const scan = await prisma.scanResult.update({
  where: { id: scanId },
  data: {
    status: 'completed',
    riskScore: 287,
    riskLevel: 'medium',
    completedAt: new Date()
  }
});
```

#### Conditional Update

```typescript
// Update only if condition met
try {
  const scan = await prisma.scanResult.update({
    where: {
      id: scanId,
      status: 'pending' // Only update if still pending
    },
    data: {
      status: 'processing',
      startedAt: new Date()
    }
  });
} catch (error) {
  // Handle case where record not found or condition not met
  console.error('Scan already processed or not found');
}
```

#### Update Many

```typescript
// Bulk update
const result = await prisma.scanResult.updateMany({
  where: {
    organizationId: orgId,
    status: 'pending',
    createdAt: {
      lt: new Date(Date.now() - 24 * 60 * 60 * 1000) // Older than 24 hours
    }
  },
  data: {
    status: 'expired',
    updatedAt: new Date()
  }
});

console.log(`Expired ${result.count} old pending scans`);
```

#### Increment/Decrement

```typescript
// Atomic increment
await prisma.organization.update({
  where: { id: orgId },
  data: {
    apiCallsUsed: {
      increment: 1
    }
  }
});

// Decrement credits
await prisma.organization.update({
  where: { id: orgId },
  data: {
    scanCredits: {
      decrement: 1
    }
  }
});
```

#### Upsert (Update or Create)

**Example**: Staging Database Sync

**File**: `packages/backend/src/utils/database-sync.ts:44-76`

```typescript
// Upsert user to staging database
await prismaStaging.user.upsert({
  where: { id: user.id },
  update: {
    email: user.email,
    passwordHash: user.passwordHash,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    organizationId: user.organizationId,
    isActive: user.isActive ?? true,
    emailVerified: user.emailVerified ?? false,
    lastLoginAt: user.lastLoginAt,
    updatedAt: user.updatedAt ?? new Date(),
    authProvider: user.authProvider,
    profilePicture: user.profilePicture
  },
  create: {
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    organizationId: user.organizationId,
    isActive: user.isActive ?? true,
    emailVerified: user.emailVerified ?? false,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt ?? new Date(),
    updatedAt: user.updatedAt ?? new Date(),
    authProvider: user.authProvider,
    profilePicture: user.profilePicture
  }
});
```

### Delete Operations

#### Soft Delete Pattern

```typescript
// Soft delete (recommended for audit trails)
const deletedUser = await prisma.user.update({
  where: { id: userId },
  data: {
    isActive: false,
    deletedAt: new Date()
  }
});

// Find only active users
const activeUsers = await prisma.user.findMany({
  where: {
    organizationId: orgId,
    isActive: true,
    deletedAt: null
  }
});
```

#### Hard Delete

```typescript
// Delete single record
const deleted = await prisma.refreshToken.delete({
  where: { token: refreshToken }
});

// Delete many
const result = await prisma.refreshToken.deleteMany({
  where: {
    expiresAt: {
      lt: new Date() // Delete expired tokens
    }
  }
});

console.log(`Deleted ${result.count} expired tokens`);
```

#### Cascade Delete

```typescript
// Delete organization (cascades to users, scans, etc via Prisma relations)
await prisma.organization.delete({
  where: { id: orgId }
});

// All related records are automatically deleted:
// - users (via organizationId FK)
// - scanResults (via organizationId FK)
// - datasets (via organizationId FK)
// - apiLogs (via organizationId FK)
// - auditLogs (via organizationId FK)
```

---

## Relationships & Joins

### One-to-Many Relationships

```typescript
// Organization → Users (1:N)
const orgWithUsers = await prisma.organization.findUnique({
  where: { id: orgId },
  include: {
    users: {
      where: {
        isActive: true
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true
      }
    }
  }
});

// User → ScanResults (1:N)
const userWithScans = await prisma.user.findUnique({
  where: { id: userId },
  include: {
    scanResults: {
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    }
  }
});
```

### One-to-One Relationships

```typescript
// Organization → Subscription (1:1)
const orgWithSubscription = await prisma.organization.findUnique({
  where: { id: orgId },
  include: {
    subscription: {
      select: {
        plan: true,
        status: true,
        expiresAt: true,
        autoRenew: true
      }
    }
  }
});

// User → UserPreferences (1:1)
const userWithPrefs = await prisma.user.findUnique({
  where: { id: userId },
  include: {
    preferences: true
  }
});
```

### Many-to-Many Relationships

```typescript
// ScanResult → ThreatIndicators (M:N via ScanThreatMatch)
const scanWithMatches = await prisma.scanResult.findUnique({
  where: { id: scanId },
  include: {
    threatIntelMatches: {
      include: {
        indicator: {
          select: {
            type: true,
            value: true,
            threatType: true,
            severity: true,
            confidence: true,
            description: true
          }
        }
      }
    }
  }
});

// Dataset → ThreatIndicators (M:N via DatasetIndicator)
const datasetWithIndicators = await prisma.dataset.findUnique({
  where: { id: datasetId },
  include: {
    indicators: {
      include: {
        indicator: true
      }
    }
  }
});
```

### Nested Writes

```typescript
// Create scan with risk categories
const scan = await prisma.scanResult.create({
  data: {
    scanType: 'url',
    url: 'https://example.com',
    contentHash: hash,
    status: 'completed',
    riskScore: 287,
    riskLevel: 'medium',
    userId: userId,
    organizationId: orgId,
    riskCategories: {
      create: [
        {
          category: 'ssl_security',
          categoryLabel: 'SSL/TLS Security',
          score: 85,
          maxScore: 100,
          severity: 'medium',
          details: { issuer: 'Let\'s Encrypt', validUntil: '2026-01-01' }
        },
        {
          category: 'reputation',
          categoryLabel: 'Domain Reputation',
          score: 95,
          maxScore: 100,
          severity: 'low',
          details: { age: '10 years', trustScore: 95 }
        }
      ]
    }
  },
  include: {
    riskCategories: true
  }
});
```

---

## Transaction Handling

### Interactive Transactions

```typescript
// Example: Transfer scan credits between organizations
async function transferCredits(
  fromOrgId: string,
  toOrgId: string,
  amount: number
) {
  return await prisma.$transaction(async (tx) => {
    // 1. Deduct from source organization
    const fromOrg = await tx.organization.update({
      where: { id: fromOrgId },
      data: {
        scanCredits: {
          decrement: amount
        }
      }
    });

    // Validate sufficient credits
    if (fromOrg.scanCredits < 0) {
      throw new Error('Insufficient credits');
    }

    // 2. Add to destination organization
    await tx.organization.update({
      where: { id: toOrgId },
      data: {
        scanCredits: {
          increment: amount
        }
      }
    });

    // 3. Create audit log
    await tx.auditLog.create({
      data: {
        action: 'credits_transfer',
        entityType: 'organization',
        entityId: fromOrgId,
        organizationId: fromOrgId,
        details: {
          toOrgId,
          amount,
          reason: 'manual_transfer'
        }
      }
    });

    return { success: true };
  });
}
```

### Sequential Transactions

```typescript
// Example: Complete registration flow with multiple operations
async function registerUserWithTransaction(data: RegisterData) {
  return await prisma.$transaction(async (tx) => {
    // 1. Create organization
    const organization = await tx.organization.create({
      data: {
        name: data.organizationName,
        tier: 'free',
        apiKey: generateApiKey(),
        apiSecret: await hashPassword(generateApiSecret()),
        scanCredits: 100 // Free tier credits
      }
    });

    // 2. Create user
    const user = await tx.user.create({
      data: {
        email: data.email,
        passwordHash: await hashPassword(data.password),
        firstName: data.firstName,
        lastName: data.lastName,
        role: 'owner',
        organizationId: organization.id
      }
    });

    // 3. Create refresh token
    const refreshToken = generateRefreshToken();
    await tx.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: getRefreshTokenExpiry()
      }
    });

    // 4. Create user preferences
    await tx.userPreferences.create({
      data: {
        userId: user.id,
        emailNotifications: true,
        scanNotifications: true,
        securityAlerts: true
      }
    });

    // 5. Audit log
    await tx.auditLog.create({
      data: {
        action: 'user_register',
        entityType: 'user',
        entityId: user.id,
        userId: user.id,
        organizationId: organization.id,
        details: { email: user.email }
      }
    });

    return { user, organization, refreshToken };
  });
}
```

### Batch Transactions

```typescript
// Example: Batch operations with Promise.all
async function processScanResults(scanId: string, results: ScanData) {
  await prisma.$transaction([
    // Update scan result
    prisma.scanResult.update({
      where: { id: scanId },
      data: {
        status: 'completed',
        riskScore: results.totalScore,
        riskLevel: results.riskLevel,
        completedAt: new Date()
      }
    }),

    // Create risk categories
    prisma.riskCategory.createMany({
      data: results.categories.map(cat => ({
        scanResultId: scanId,
        category: cat.name,
        categoryLabel: cat.label,
        score: cat.score,
        maxScore: cat.maxScore,
        severity: cat.severity,
        details: cat.details
      }))
    }),

    // Create threat matches
    prisma.scanThreatMatch.createMany({
      data: results.threatMatches.map(match => ({
        scanResultId: scanId,
        indicatorId: match.indicatorId,
        matchType: match.type,
        matchConfidence: match.confidence
      })),
      skipDuplicates: true
    }),

    // Update organization usage stats
    prisma.organization.update({
      where: { id: results.organizationId },
      data: {
        totalScans: { increment: 1 },
        scanCredits: { decrement: 1 }
      }
    })
  ]);
}
```

### Transaction Timeout Configuration

```typescript
// Set custom timeout for long-running transactions
await prisma.$transaction(
  async (tx) => {
    // Long-running operations
    await processLargeDataset(tx);
  },
  {
    maxWait: 30000, // 30 seconds max wait to acquire transaction
    timeout: 60000  // 60 seconds max transaction duration
  }
);
```

---

## Migration Strategy

### Migration Workflow

```mermaid
graph LR
    A[Schema Changes] --> B[Create Migration]
    B --> C[Review SQL]
    C --> D[Test Locally]
    D --> E[Deploy to Dev]
    E --> F[Deploy to Prod]
    F --> G[Verify Data]
```

### Creating Migrations

```bash
# Development: Create migration with prompt for name
cd packages/backend
npx prisma migrate dev

# Production: Apply pending migrations
npx prisma migrate deploy

# Generate Prisma Client after schema changes
npx prisma generate

# Reset database (DESTRUCTIVE - Dev only!)
npx prisma migrate reset
```

### Migration File Structure

**Directory**: `packages/backend/prisma/migrations/`

```
migrations/
├── 20250110_intelligence_data/
│   └── migration.sql
├── 20251004200928_/
│   └── migration.sql
├── 20251006131837_add_literacy_and_recovery_tables/
│   └── migration.sql
├── 20251007_add_chatbot_tables/
│   └── migration.sql
├── 20251008162927_add_api_keys_webhooks/
│   └── migration.sql
├── 20251010_add_missing_tables/
│   └── migration.sql
├── 20251011_add_api_keys_webhooks_social_auth/
│   └── migration.sql
├── 20251012_add_media_storage/
│   └── migration.sql
├── 20251012_add_verdict_ocr_fields/
│   └── migration.sql
└── 20251015_add_scan_engine_tables/
    └── migration.sql
```

### Example Migration File

**File**: `20251010_add_missing_tables/migration.sql` (excerpt)

```sql
-- CreateEnum for subscriptions
DO $$ BEGIN
 CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'expired', 'cancelled', 'suspended');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "SubscriptionPlan" AS ENUM ('free', 'premium_monthly', 'premium_annual', 'enterprise');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateTable: ThreatIntelSource
CREATE TABLE IF NOT EXISTS "threat_intel_sources" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL UNIQUE,
    "type" TEXT NOT NULL,
    "url" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "totalIndicators" INTEGER NOT NULL DEFAULT 0,
    "syncFrequency" INTEGER NOT NULL DEFAULT 3600,
    "apiKey" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable: ThreatIndicator
CREATE TABLE IF NOT EXISTS "threat_indicators" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "threatType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "confidence" INTEGER NOT NULL DEFAULT 50,
    "description" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "threat_indicators_sourceId_fkey"
        FOREIGN KEY ("sourceId")
        REFERENCES "threat_intel_sources"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "threat_indicators_type_value_idx"
    ON "threat_indicators"("type", "value");

CREATE INDEX "threat_indicators_sourceId_idx"
    ON "threat_indicators"("sourceId");
```

### Migration Best Practices

1. **Always Review SQL**: Before applying, review generated SQL
2. **Test Locally First**: Run migrations in dev environment
3. **Backup Before Production**: Always backup before prod migrations
4. **Use Transactions**: Wrap DDL in transactions when possible
5. **IF NOT EXISTS**: Use `CREATE TABLE IF NOT EXISTS` for idempotency
6. **Handle Failures**: Use `DO $$ BEGIN ... EXCEPTION ... END $$;` blocks
7. **Document Changes**: Use descriptive migration names

### Schema Push (Development Only)

```bash
# Push schema changes without creating migration
# ONLY for development/prototyping
npx prisma db push

# Useful for rapid iteration but not for production
```

### Introspection (Schema from Existing DB)

```bash
# Generate Prisma schema from existing database
npx prisma db pull

# Useful for:
# - Importing legacy databases
# - Syncing schema with manual SQL changes
```

---

## Performance Optimization

### 1. Select Only Needed Fields

```typescript
// ❌ BAD: Fetch entire user object (includes passwordHash)
const user = await prisma.user.findUnique({
  where: { id: userId }
});

// ✅ GOOD: Select only needed fields
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    role: true
  }
});
```

### 2. Use Indexes Effectively

```prisma
// Define indexes in schema.prisma
model ScanResult {
  id             String   @id @default(cuid())
  organizationId String
  userId         String
  status         String
  createdAt      DateTime @default(now())

  // Composite indexes for common queries
  @@index([organizationId, createdAt])
  @@index([userId, status])
  @@index([status, createdAt])
}
```

### 3. Batch Queries

```typescript
// ❌ BAD: N+1 query problem
const users = await prisma.user.findMany();
for (const user of users) {
  const scans = await prisma.scanResult.findMany({
    where: { userId: user.id }
  });
  user.scans = scans;
}

// ✅ GOOD: Single query with include
const users = await prisma.user.findMany({
  include: {
    scanResults: true
  }
});
```

### 4. Use findUnique for Primary/Unique Keys

```typescript
// ✅ GOOD: Uses index scan
const user = await prisma.user.findUnique({
  where: { email: 'user@example.com' } // email is unique
});

// ❌ LESS EFFICIENT: Uses sequential scan
const user = await prisma.user.findFirst({
  where: { email: 'user@example.com' }
});
```

### 5. Limit Result Sets

```typescript
// Always use take/limit for large datasets
const recentScans = await prisma.scanResult.findMany({
  where: { organizationId: orgId },
  orderBy: { createdAt: 'desc' },
  take: 100 // Limit to 100 results
});
```

### 6. Connection Pooling

```typescript
// Reuse Prisma client instance (singleton pattern)
// See "Prisma Client Architecture" section above

// ✅ CORRECT
import { prisma } from '../config/database.js';

// ❌ INCORRECT
const prisma = new PrismaClient(); // Creates new connection pool!
```

### 7. Query Optimization Monitoring

```typescript
// Enable query logging to identify slow queries
prisma.$on('query' as never, (e: any) => {
  if (e.duration > 1000) { // Queries slower than 1 second
    logger.warn(`Slow query detected (${e.duration}ms): ${e.query}`);
  }
});
```

### 8. Caching Strategy

```typescript
// Cache frequent queries with Redis
import { redis } from '../config/redis.js';

async function getUserWithCache(userId: string) {
  // Check cache first
  const cached = await redis.get(`user:${userId}`);
  if (cached) {
    return JSON.parse(cached);
  }

  // Fetch from database
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true
    }
  });

  // Cache for 5 minutes
  await redis.setex(`user:${userId}`, 300, JSON.stringify(user));

  return user;
}
```

---

## Error Handling

### Common Prisma Errors

```typescript
import {
  PrismaClientKnownRequestError,
  PrismaClientUnknownRequestError,
  PrismaClientValidationError,
  PrismaClientInitializationError
} from '@prisma/client/runtime/library';

async function createUser(data: UserData) {
  try {
    const user = await prisma.user.create({ data });
    return { success: true, user };
  } catch (error) {
    // 1. Known Prisma errors (P2000-P2999)
    if (error instanceof PrismaClientKnownRequestError) {
      switch (error.code) {
        case 'P2002':
          // Unique constraint violation
          const field = error.meta?.target as string[];
          return {
            success: false,
            error: `${field[0]} already exists`
          };

        case 'P2003':
          // Foreign key constraint violation
          return {
            success: false,
            error: 'Referenced record does not exist'
          };

        case 'P2025':
          // Record not found
          return {
            success: false,
            error: 'Record not found'
          };

        default:
          logger.error(`Prisma error ${error.code}:`, error);
          return {
            success: false,
            error: 'Database error'
          };
      }
    }

    // 2. Validation errors (schema mismatch)
    if (error instanceof PrismaClientValidationError) {
      logger.error('Validation error:', error.message);
      return {
        success: false,
        error: 'Invalid data format'
      };
    }

    // 3. Connection errors
    if (error instanceof PrismaClientInitializationError) {
      logger.error('Database connection error:', error);
      return {
        success: false,
        error: 'Database connection failed'
      };
    }

    // 4. Unknown errors
    logger.error('Unknown error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}
```

### Error Code Reference

| Code | Description | Handling |
|------|-------------|----------|
| **P2000** | Value too long for column | Validate input length |
| **P2001** | Record not found (where condition) | Check existence first |
| **P2002** | Unique constraint violation | Handle duplicate gracefully |
| **P2003** | Foreign key constraint failed | Validate FK exists |
| **P2011** | Null constraint violation | Provide required fields |
| **P2014** | Relation violation | Handle cascade properly |
| **P2025** | Record to update/delete not found | Check before update |

### Transaction Error Handling

```typescript
async function transferCreditsWithErrorHandling(
  fromOrgId: string,
  toOrgId: string,
  amount: number
) {
  try {
    return await prisma.$transaction(async (tx) => {
      const fromOrg = await tx.organization.update({
        where: { id: fromOrgId },
        data: { scanCredits: { decrement: amount } }
      });

      if (fromOrg.scanCredits < 0) {
        // Throw error to rollback transaction
        throw new Error('Insufficient credits');
      }

      await tx.organization.update({
        where: { id: toOrgId },
        data: { scanCredits: { increment: amount } }
      });

      return { success: true };
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Insufficient credits') {
      return {
        success: false,
        error: 'Insufficient credits for transfer'
      };
    }

    logger.error('Transfer failed:', error);
    return {
      success: false,
      error: 'Transfer failed'
    };
  }
}
```

### Retry Logic for Transient Errors

```typescript
async function executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Retry only on transient errors
      if (
        error instanceof PrismaClientKnownRequestError &&
        ['P1001', 'P1002', 'P1008', 'P1017'].includes(error.code)
      ) {
        logger.warn(`Database operation failed (attempt ${attempt}/${maxRetries}), retrying...`);
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
        continue;
      }

      // Don't retry on non-transient errors
      throw error;
    }
  }

  throw lastError;
}

// Usage
const user = await executeWithRetry(() =>
  prisma.user.findUnique({ where: { id: userId } })
);
```

---

## Best Practices

### 1. Always Use TypeScript Types

```typescript
// ✅ GOOD: Use Prisma-generated types
import { User, Organization, ScanResult } from '@prisma/client';

function processUser(user: User) {
  console.log(user.email); // Type-safe
}

// Also use Prisma helper types
import { Prisma } from '@prisma/client';

type UserWithOrg = Prisma.UserGetPayload<{
  include: { organization: true }
}>;

function processUserWithOrg(user: UserWithOrg) {
  console.log(user.organization.name); // Type-safe
}
```

### 2. Implement Soft Deletes

```prisma
model User {
  id        String    @id @default(cuid())
  email     String    @unique
  isActive  Boolean   @default(true)
  deletedAt DateTime?
  // ... other fields
}
```

```typescript
// Soft delete
await prisma.user.update({
  where: { id: userId },
  data: { isActive: false, deletedAt: new Date() }
});

// Filter out deleted records
const activeUsers = await prisma.user.findMany({
  where: {
    isActive: true,
    deletedAt: null
  }
});
```

### 3. Use Audit Logs

**File**: `packages/backend/src/controllers/auth.controller.ts:108-118`

```typescript
// Always log important actions
await prisma.auditLog.create({
  data: {
    action: 'user_register',
    entityType: 'user',
    entityId: user.id,
    userId: user.id,
    organizationId: organization.id,
    details: { email: user.email },
    ipAddress: req.ip
  }
});
```

### 4. Validate Input with Zod

```typescript
import { z } from 'zod';

const createUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  password: z.string().min(8),
  organizationName: z.string().min(1).max(200)
});

// Validate before database operation
try {
  const validatedData = createUserSchema.parse(req.body);
  const user = await prisma.user.create({ data: validatedData });
} catch (error) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ errors: error.errors });
  }
}
```

### 5. Sanitize JSON Fields

**File**: `packages/backend/src/controllers/scan.controller.ts:36-64`

```typescript
// Sanitize objects before storing in JSONB columns
private sanitizeForDatabase(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }

  if (typeof obj === 'function') {
    return null;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => this.sanitizeForDatabase(item))
      .filter(item => item !== null);
  }

  const sanitized: any = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      if (typeof value !== 'function' && value !== undefined) {
        sanitized[key] = this.sanitizeForDatabase(value);
      }
    }
  }
  return sanitized;
}

// Usage
await prisma.scanResult.create({
  data: {
    // ... other fields
    metadata: this.sanitizeForDatabase(rawMetadata)
  }
});
```

### 6. Implement Graceful Shutdown

```typescript
// server.ts
const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
  console.log(`${signal} received, shutting down gracefully...`);

  // Stop accepting new connections
  server.close(() => {
    console.log('HTTP server closed');
  });

  // Close database connections
  await prisma.$disconnect();
  if (prismaStaging) {
    await prismaStaging.$disconnect();
  }

  console.log('Database connections closed');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

### 7. Use Prepared Statements (Automatic)

Prisma automatically uses prepared statements for all queries, protecting against SQL injection:

```typescript
// ✅ SAFE: Prisma handles escaping automatically
const user = await prisma.user.findUnique({
  where: { email: userInput } // Automatically sanitized
});

// ❌ UNSAFE: Raw SQL requires manual escaping
await prisma.$executeRawUnsafe(`
  SELECT * FROM users WHERE email = '${userInput}'
`); // SQL INJECTION RISK!

// ✅ SAFE: Use $executeRaw with parameters
await prisma.$executeRaw`
  SELECT * FROM users WHERE email = ${userInput}
`;
```

### 8. Monitor Query Performance

```typescript
// Log slow queries
let queryCount = 0;
let slowQueryCount = 0;

prisma.$use(async (params, next) => {
  const before = Date.now();
  const result = await next(params);
  const after = Date.now();
  const duration = after - before;

  queryCount++;

  if (duration > 1000) {
    slowQueryCount++;
    logger.warn(`Slow query (${duration}ms): ${params.model}.${params.action}`);
  }

  return result;
});

// Periodic metrics logging
setInterval(() => {
  logger.info(`Query metrics: ${queryCount} total, ${slowQueryCount} slow queries`);
  queryCount = 0;
  slowQueryCount = 0;
}, 60000); // Every minute
```

---

## Production Metrics

### Current Database Scale (as of 2025-10-24)

| Metric | Value | Notes |
|--------|-------|-------|
| **Total Models** | 45 | All Prisma models |
| **Schema LOC** | 1,669 | Lines in schema.prisma |
| **Migrations** | 27+ | Total migration files |
| **Database Size** | ~150 MB | Total across all databases |
| **Threat Indicators** | 200,234 | In elara_threat_intel DB |
| **Active Users** | Varies | Across prod/dev |
| **Scan Results** | Varies | Production data |

### Query Performance Targets

| Operation | Target | P95 Acceptable | Notes |
|-----------|--------|----------------|-------|
| **Find by PK** | < 10ms | < 20ms | Indexed lookup |
| **Find by Index** | < 50ms | < 100ms | Secondary index |
| **Find Many (100)** | < 100ms | < 200ms | With pagination |
| **Create** | < 50ms | < 100ms | Single record |
| **Create Many (100)** | < 500ms | < 1000ms | Bulk insert |
| **Update** | < 50ms | < 100ms | Single record |
| **Delete** | < 50ms | < 100ms | Single record |
| **Transaction (3 ops)** | < 200ms | < 500ms | Interactive transaction |

### Connection Pool Metrics

| Metric | Production | Development |
|--------|------------|-------------|
| **Backend Pods** | 3 | 1 |
| **Worker Pods** | 3 | 1 |
| **Connections per Pod** | ~10 | ~10 |
| **Total Connections** | 60-70 | 10-20 |
| **Max Connections (Cloud SQL)** | 100 | 100 |
| **Utilization** | 60-70% | 10-20% |

### Migration Execution Times

| Migration Type | Avg Duration | Notes |
|----------------|--------------|-------|
| **Add Column** | < 1s | Non-blocking |
| **Add Index** | 5-30s | Depends on table size |
| **Add Table** | < 1s | Instant |
| **Alter Column** | 1-60s | May require table rewrite |
| **Drop Column** | < 1s | Non-blocking in PostgreSQL |

### Recommendations

1. **Monitor Connection Pool**: Keep utilization below 80%
2. **Index Slow Queries**: Add indexes for queries > 100ms
3. **Batch Operations**: Use `createMany` for bulk inserts
4. **Cache Frequently Read Data**: Use Redis for hot data
5. **Archive Old Data**: Move historical data to separate tables
6. **Regular Vacuum**: Run `VACUUM ANALYZE` on large tables

---

## Summary

This document provides comprehensive end-to-end architecture for Prisma ORM usage in the Elara platform:

✅ **Singleton pattern** for connection pooling
✅ **Type-safe queries** with TypeScript
✅ **45 models** fully documented
✅ **Production-tested** migration strategy
✅ **Performance optimization** patterns
✅ **Error handling** best practices
✅ **Transaction support** for complex operations
✅ **Real code examples** from codebase

For schema details, see: `docs/architecture/database/prisma-schema-complete.md`
For API endpoints, see: `docs/api/complete-api-reference.md`
For infrastructure, see: `docs/CURRENT_GCP_INFRASTRUCTURE.md`

---

**End of Document**
