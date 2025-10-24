# Elara Platform - Enterprise Security & Threat Intelligence

> **Production-ready cybersecurity platform with automated deployment to Google Cloud Platform**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![GCP](https://img.shields.io/badge/Cloud-GCP-4285F4?logo=google-cloud)](https://cloud.google.com)
[![Kubernetes](https://img.shields.io/badge/Orchestration-Kubernetes-326CE5?logo=kubernetes)](https://kubernetes.io)
[![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions%20%2B%20Cloud%20Build-2088FF?logo=github-actions)](https://github.com/features/actions)

## Overview

Elara is an enterprise-grade cybersecurity platform that provides comprehensive threat intelligence, real-time URL scanning, AI-powered security analysis, and automated threat detection. Built with modern cloud-native architecture and deployed on Google Cloud Platform.

### Key Features

- **Real-time Threat Intelligence**: Integration with 18+ threat intelligence sources (AbuseIPDB, URLhaus, ThreatFox, AlienVault OTX, etc.)
- **AI-Powered Security Analysis**: Advanced AI consensus engine for threat detection and analysis
- **Enterprise URL Scanning**: Real-time malware, phishing, and security scanning
- **Admin Control Panel**: Comprehensive dashboard for threat source management
- **Secure Browser Extension**: Real-time protection while browsing
- **WhatsApp Integration**: Security scanning via WhatsApp bot
- **Multi-tier System**: Free, Pro, and Enterprise user tiers

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Google Cloud Platform                    │
├─────────────────────────────────────────────────────────────┤
│  GKE Autopilot Cluster (us-west1)                           │
│  ├── Backend API (Node.js + Express + Prisma)               │
│  ├── Frontend (React + TypeScript + Vite)                   │
│  ├── Proxy Service (Puppeteer + Security Scanning)          │
│  └── Browser Extension (Chrome/Firefox)                     │
├─────────────────────────────────────────────────────────────┤
│  Cloud SQL PostgreSQL (Optimized: 2 vCPU, 7.5GB RAM)        │
│  ├── elara_production                                       │
│  ├── elara_dev                                              │
│  └── elara_threat_intel                                     │
├─────────────────────────────────────────────────────────────┤
│  Cloud Memorystore Redis (1GB, High Availability)           │
├─────────────────────────────────────────────────────────────┤
│  Cloud Build (CI/CD Automation)                             │
│  Container Registry (Docker Images)                         │
│  Cloud Load Balancing (Global)                              │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- **Node.js** >= 18.x
- **pnpm** >= 8.x
- **Google Cloud SDK** (gcloud CLI)
- **kubectl**
- **Git**

### Local Development Setup

```bash
# Clone the repository
git clone https://github.com/YOUR_ORG/elara-mvp-final.git
cd elara-mvp-final

# Install dependencies
pnpm install

# Set up environment variables
cp packages/backend/.env.example packages/backend/.env
cp packages/frontend/.env.example packages/frontend/.env

# Start development servers
pnpm dev:backend   # Backend API on http://localhost:5000
pnpm dev:frontend  # Frontend on http://localhost:5173
```

See [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md) for detailed local development guide.

## Deployment Workflow

### Automated CI/CD Pipeline

```
Local Development → Git Push → GitHub Actions → Cloud Build → GKE Deployment
```

#### Development Environment
```bash
# Push to develop branch
git checkout develop
git add .
git commit -m "feat: new feature"
git push origin develop

# ✅ Auto-triggers deployment to dev environment
# Backend: http://35.199.176.26/api
# Frontend: http://136.117.33.149/
# Namespaces: elara-backend-dev, elara-frontend-dev, elara-proxy-dev, elara-workers-dev
```

#### Production Environment
```bash
# Push to main branch
git checkout main
git merge develop
git push origin main

# ✅ Auto-triggers deployment to production
# Backend: http://34.36.48.252/api
# Frontend: http://34.36.48.252/
# Namespaces: elara-backend, elara-frontend, elara-proxy, elara-workers
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed deployment guide.

## Repository Structure

```
elara-mvp-final/
├── packages/                      # Application code
│   ├── backend/                   # Node.js + Express + Prisma API
│   │   ├── src/
│   │   │   ├── controllers/       # Request handlers
│   │   │   ├── routes/            # API routes
│   │   │   ├── services/          # Business logic
│   │   │   ├── middleware/        # Auth, validation, etc.
│   │   │   └── models/            # Database models
│   │   ├── prisma/                # Database schema & migrations
│   │   └── package.json
│   ├── frontend/                  # React + TypeScript + Vite
│   │   ├── src/
│   │   │   ├── components/        # React components
│   │   │   ├── pages/             # Page components
│   │   │   ├── hooks/             # Custom React hooks
│   │   │   ├── services/          # API services
│   │   │   └── utils/             # Utilities
│   │   └── package.json
│   ├── proxy-service/             # Security scanning proxy
│   ├── browser-extension/         # Chrome/Firefox extension
│   └── shared/                    # Shared utilities & types
├── infrastructure/                # Cloud infrastructure
│   ├── kubernetes/                # K8s manifests
│   │   ├── base/                  # Base configurations
│   │   ├── deployments/           # Deployment specs
│   │   ├── services/              # Service definitions
│   │   ├── ingress/               # Ingress controllers
│   │   └── configmaps/            # Configuration
│   ├── terraform/                 # Infrastructure as Code
│   │   ├── main.tf                # GCP resources
│   │   ├── modules/               # Reusable modules
│   │   └── environments/          # Environment configs
│   └── cloudbuild/                # Cloud Build configs
│       ├── dev.yaml               # Dev build pipeline
│       ├── prod.yaml              # Prod build pipeline
│       └── staging.yaml           # Staging build pipeline
├── .github/                       # GitHub configuration
│   └── workflows/                 # GitHub Actions
│       ├── deploy-dev.yml         # Auto-deploy to dev
│       └── deploy-prod.yml        # Auto-deploy to prod
├── docs/                          # Documentation
│   ├── LOCAL_DEVELOPMENT.md       # Local dev guide
│   ├── DEPLOYMENT.md              # Deployment guide
│   ├── ARCHITECTURE.md            # System architecture
│   ├── API_DOCUMENTATION.md       # API reference
│   └── TROUBLESHOOTING.md         # Common issues
├── scripts/                       # Utility scripts
│   ├── setup-gcp.sh               # GCP setup automation
│   ├── db-migration.sh            # Database migrations
│   └── backup-restore.sh          # Backup utilities
├── package.json                   # Root package config
├── pnpm-workspace.yaml            # Monorepo config
└── README.md                      # This file
```

## Technology Stack

### Backend
- **Runtime**: Node.js 20.x
- **Framework**: Express.js
- **ORM**: Prisma
- **Database**: PostgreSQL 15
- **Caching**: Redis
- **Authentication**: JWT + bcrypt
- **API Documentation**: OpenAPI/Swagger

### Frontend
- **Framework**: React 18
- **Language**: TypeScript
- **Build Tool**: Vite
- **UI Library**: Material-UI (MUI)
- **State Management**: React Context + Hooks
- **HTTP Client**: Axios
- **Routing**: React Router

### Infrastructure
- **Cloud Provider**: Google Cloud Platform
- **Container Orchestration**: Kubernetes (GKE Autopilot)
- **CI/CD**: GitHub Actions + Cloud Build
- **IaC**: Terraform
- **Monitoring**: Cloud Monitoring + Logging

## Development Workflow

### 1. Local Development

```bash
# Start all services
pnpm dev

# Or start individually
pnpm dev:backend   # http://localhost:5000
pnpm dev:frontend  # http://localhost:5173
pnpm dev:proxy     # http://localhost:8080
```

### 2. Testing

```bash
# Run all tests
pnpm test

# Run backend tests
pnpm test:backend

# Run frontend tests
pnpm test:frontend

# Run with coverage
pnpm test:coverage
```

### 3. Building

```bash
# Build all packages
pnpm build

# Build backend only
pnpm build:backend

# Build frontend only
pnpm build:frontend
```

### 4. Code Quality

```bash
# Lint code
pnpm lint

# Format code
pnpm format

# Type check
pnpm type-check
```

## Deployment

### Prerequisites

1. **Google Cloud Project**: `elara-mvp-13082025-u1`
2. **GKE Cluster**: `elara-gke-us-west1` (Autopilot, us-west1)
3. **Cloud SQL Instance**: `elara-postgres-optimized` (2 vCPU, 7.5GB RAM, 100GB)
4. **Redis Instance**: `elara-redis-primary` (5GB, STANDARD_HA)
5. **GitHub Repository**: With Actions enabled

### GitHub Secrets Configuration

Configure these secrets in GitHub repository settings:

```
GCP_PROJECT_ID       = elara-mvp-13082025-u1
GCP_SA_KEY           = <service-account-key-json>
GH_PAT               = <github-personal-access-token>
```

### Deployment Commands

```bash
# Deploy to development
git push origin develop

# Deploy to staging
git push origin staging

# Deploy to production
git push origin main
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed instructions.

## Infrastructure Costs

**Current Monthly Cost**: ~$450-600/month (cost-optimized configuration)

| Resource | Configuration | Monthly Cost |
|----------|--------------|--------------|
| GKE Autopilot | 5 nodes, us-west1 | $200-250 |
| Cloud SQL PostgreSQL | db-custom-2-7680 (2 vCPU, 7.5GB, 100GB, Zonal) | $150 |
| Cloud Memorystore Redis | 5GB, STANDARD_HA | $60 |
| Cloud Load Balancer | Global + Regional | $40 |
| Cloud Build | CI/CD automation | $20-30 |
| Container Registry | Image storage | $10 |
| Cloud Monitoring & Logging | Standard tier | $20 |
| Network Egress | Moderate usage | $20-30 |

**Note**: This is the current cost-optimized deployment. Terraform configuration shows planned higher-tier setup for production scaling.

## Database Schema

### Production Databases

- **elara_production**: Main production database (active)
- **elara_dev**: Development database (active)
- **elara_staging**: Staging database (dormant, not deployed)
- **elara_threat_intel**: Shared threat intelligence database (200K+ indicators, shared across environments)

### Key Tables

- `users`: User accounts and authentication
- `scan_results`: URL/file scan results
- `threat_intel_sources`: 18 threat intelligence sources
- `threat_indicators`: 200K+ threat indicators (IPs, URLs, hashes)
- `ai_consensus_results`: AI-powered threat analysis
- `subscription_tiers`: Free, Pro, Enterprise tiers
- `chatbot_conversations`: Ask Elara chatbot interactions

## Security Features

- JWT-based authentication
- Role-based access control (RBAC)
- API rate limiting
- SQL injection protection (Prisma ORM)
- XSS protection
- CORS configuration
- Secrets management (Cloud Secret Manager)
- Network policies (Private VPC)
- Database encryption at rest
- TLS/SSL encryption in transit

## Monitoring & Logging

- Cloud Monitoring for infrastructure metrics
- Cloud Logging for application logs
- Custom dashboards for threat intel sync status
- Alert policies for errors and downtime
- Health check endpoints: `/api/health`

## Support & Documentation

- **Documentation**: [docs/](docs/)
- **API Reference**: [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md)
- **Troubleshooting**: [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
- **Architecture**: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Authors

- **Development Team**: Elara Security Platform
- **Cloud Infrastructure**: Optimized for GCP
- **Maintained by**: Enterprise Security Team

---

**Version**: 1.0.0
**Last Updated**: 2025-10-24
**Status**: Production Ready ✅

For detailed setup instructions, see [docs/SETUP.md](docs/SETUP.md)
