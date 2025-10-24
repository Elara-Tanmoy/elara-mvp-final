# Changelog

All notable changes to the Elara Platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2025-10-15

### 🎉 First Stable Release

This is the first production-ready release of Elara - Enterprise Threat Detection Platform.

### Added

#### Core Features
- **URL Threat Scanner** with 13 categories and 350-point scoring system
  - Domain analysis, SSL/TLS validation, threat intelligence integration
  - Google Safe Browsing, VirusTotal, AbuseIPDB integration
  - Phishing pattern detection and brand impersonation analysis
- **Message Scanner** with AI-powered phishing detection
- **File Scanner** with OCR-enabled image and PDF analysis
- **Multi-LLM AI Engine** (Claude Sonnet 4.5, GPT-4, Gemini)
- **RAG System** with ChromaDB vector database
- **Dataset Management** for custom threat intelligence

#### Infrastructure
- Multi-environment deployment (Production, Staging, Development)
- GitHub Actions CI/CD workflows
  - `deploy-development.yml` - Auto-deploy on push to develop
  - `deploy-staging.yml` - Auto-deploy on push to staging
- Cloud Build configurations for all environments
  - `gcp-config/cloudbuild-dev.yaml`
  - `gcp-config/cloudbuild-staging.yaml`
- Docker multi-stage builds
  - `Dockerfile.backend` - Node.js API
  - `Dockerfile.frontend` - React + Nginx
  - `Dockerfile.worker` - BullMQ workers
  - `Dockerfile.proxy` - Python proxy service
- Kubernetes deployments on GKE
- PostgreSQL database with Prisma ORM
- Redis caching layer

#### Frontend
- Environment-specific banners for DEV/STAGING
  - `EnvironmentBanner.tsx` component
  - Environment detection via `VITE_ENVIRONMENT`
- React 18 with TypeScript
- Vite for fast development
- Tailwind CSS styling
- Responsive layout with `LayoutAccessible.tsx`

#### Documentation
- **FOR_CLAUDE_SESSIONS.md** - Guidelines for AI assistant sessions
- **REPOSITORY_STRUCTURE.md** - Complete repository structure guide
- **CI_CD_GUIDE.md** - Deployment pipeline documentation
- **TROUBLESHOOTING.md** - Common issues and solutions
- **README.md** - Updated with comprehensive project overview

#### Security
- JWT authentication (30min access tokens, 7-day refresh tokens)
- bcrypt password hashing (12 rounds)
- Role-based access control (User, Admin, Owner)
- Tier-based rate limiting (Free: 100/hr, Pro: 1000/hr, Enterprise: 10000/hr)
- Helmet.js security headers
- Zod schema validation
- SQL injection prevention via Prisma

### Fixed
- 🐛 URL scan timeout issues in staging/dev environments
- 🐛 Inconsistent scan response formats between environments
- 🐛 Environment banner not displaying in deployed environments
- 🐛 Login failures in staging/dev (API connectivity issues)
- 🐛 Docker build context path issues (removed incorrect `elara-platform/` prefixes)
- 🐛 Frontend API URL configuration (changed to relative `/api` path)
- 🐛 Kubernetes container name mismatches in kubectl commands

### Changed
- 🔧 Switched from queue-based to synchronous processing for stability
  - Removed REDIS_URL from staging/dev deployments
  - Ensures consistent behavior across all environments
- 🔧 Updated frontend API URL to use nginx proxy (`/api` instead of full URL)
- 🔧 Enhanced logging for better debugging and monitoring
- 🔧 Improved error handling in scan controllers
- 🔧 Optimized Docker builds with proper layer caching

### Technical Details

#### Deployments
- **Production**: http://34.36.48.252/ (main branch)
- **Staging**: http://34.83.95.127/ (staging branch)
- **Development**: http://136.117.33.149/ (develop branch)

#### GCP Resources
- **Project ID**: elara-mvp-13082025-u1
- **Region**: us-west1
- **GKE Cluster**: elara-gke-us-west1
- **Container Registry**: gcr.io/elara-mvp-13082025-u1/

#### Database Schema
- Organization (multi-tenancy)
- User (authentication)
- ScanResult (all scan types)
- RiskCategory (category-specific scores)
- Dataset (threat intelligence)
- DatasetEntry (vectorized data)
- AuditLog (audit trail)
- RefreshToken (JWT management)

### Known Limitations
1. BullMQ workers currently disabled (synchronous processing enabled)
2. AI API credits running low (fallback mechanisms in place)
3. Neo4j Trust Graph feature optional (not required for core functionality)

### Migration Notes
- No database migrations required for fresh installations
- Existing deployments: Remove REDIS_URL environment variable if queue processing is not needed

---

## [Unreleased]

### Planned Features
- Enhanced AI models and consensus algorithms
- Real-time threat intelligence feeds
- Advanced reporting and analytics
- API rate limiting improvements
- Mobile application support
- SSO integration
- Multi-tenancy enhancements
- BullMQ worker stability improvements

---

## Version History

- **v1.0.0** (2025-10-15) - First Stable Release

---

**Legend:**
- 🎉 Major release
- ✨ New feature
- 🐛 Bug fix
- 🔧 Configuration change
- 📖 Documentation
- ⚡ Performance improvement
- 🔒 Security enhancement
- 🗑️ Deprecated feature
- ❌ Removed feature

---

For detailed release information, see: https://github.com/Elara-Tanmoy/elara-platform/releases
