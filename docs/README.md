# Elara - Enterprise Threat Detection Platform

A complete production-ready enterprise threat detection platform with AI-powered threat analysis, RAG-enhanced intelligence, and comprehensive scanning capabilities.

## 📚 Documentation

**Essential Reading:**
- **[FOR_CLAUDE_SESSIONS.md](FOR_CLAUDE_SESSIONS.md)** - ⚠️ START HERE for AI assistants - Common mistakes and critical rules
- **[REPOSITORY_STRUCTURE.md](REPOSITORY_STRUCTURE.md)** - Complete repository structure guide
- **[CI_CD_GUIDE.md](CI_CD_GUIDE.md)** - GitHub Actions + Cloud Build deployment pipeline
- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Solutions to common issues
- **[COMPREHENSIVE_PROJECT_DOCUMENTATION.md](COMPREHENSIVE_PROJECT_DOCUMENTATION.md)** - Detailed project overview

**Deployment Environments:**
- **Production:** http://34.36.48.252/ (main branch)
- **Staging:** http://34.83.95.127/ (staging branch)
- **Development:** http://136.117.33.149/ (develop branch)

**Quick Links:**
- GitHub Actions Workflows: `.github/workflows/`
- Cloud Build Configs: `gcp-config/cloudbuild-*.yaml`
- Dockerfiles: `gcp-config/docker/`
- Backend API: `packages/backend/`
- Frontend: `packages/frontend/`

---

## 🚀 Features

### Core Capabilities
- **URL Threat Scanner**: Analyze URLs across 13 threat categories (350 points total)
- **Message Scanner**: AI-powered phishing and social engineering detection
- **File Scanner**: OCR-enabled image and PDF threat analysis
- **Multi-LLM AI**: Claude Sonnet 4.5, GPT-4, and Gemini with intelligent fallback
- **RAG System**: ChromaDB vector database for local threat intelligence
- **Dataset Management**: CSV upload, parsing, and vectorization for custom threat data

### 13 Threat Categories (URL Scanner)
1. **Domain Analysis** (40 pts) - WHOIS data, domain age, parking detection
2. **SSL/TLS Analysis** (45 pts) - Certificate validation, HSTS headers, cipher strength
3. **Threat Intelligence** (50 pts) - Google Safe Browsing, VirusTotal, AbuseIPDB integration
4. **Content Analysis** (40 pts) - HTML parsing, JavaScript analysis, hidden elements
5. **Phishing Patterns** (50 pts) - Brand impersonation, typosquatting detection
6. **Malware Detection** (45 pts) - Drive-by downloads, exploit kits
7. **Behavioral Analysis** (25 pts) - Redirect chains, URL patterns
8. **Social Engineering** (30 pts) - Urgency tactics, authority impersonation
9. **Financial Fraud** (25 pts) - Payment fraud, cryptocurrency scams
10. **Identity Theft** (20 pts) - PII harvesting detection
11. **Technical Exploits** (15 pts) - SQL injection, XSS, CSRF detection
12. **Brand Impersonation** (20 pts) - Logo theft, trademark violations
13. **Network Analysis** (15 pts) - IP reputation, ASN scoring

## 🏗️ Architecture

### Monorepo Structure
```
elara-platform/
├── packages/
│   ├── backend/          # Node.js + Express + Prisma API
│   ├── frontend/         # React 18 + TypeScript + Vite
│   ├── admin/            # Admin dashboard (React)
│   └── shared/           # Shared types and utilities
├── infrastructure/
│   ├── terraform/        # GCP infrastructure as code
│   └── k8s/             # Kubernetes manifests
└── docker-compose.yml    # Local development services
```

### Technology Stack

**Backend:**
- Node.js 18+ with TypeScript
- Express.js for REST API
- Prisma ORM with PostgreSQL
- Redis for caching and BullMQ queues
- ChromaDB for vector storage
- Multi-LLM AI integration (Claude, GPT-4, Gemini)

**Frontend:**
- React 18 with TypeScript
- Vite for fast development
- Tailwind CSS for styling
- Lucide React for icons
- Axios for API calls

**Infrastructure:**
- Docker & Docker Compose
- Google Cloud Platform (GKE, Cloud SQL, Cloud Storage)
- Terraform for infrastructure as code
- Kubernetes for orchestration

## 📦 Installation

### Prerequisites
- Node.js 18+ and pnpm 8+
- Docker and Docker Compose
- PostgreSQL 16
- Redis 7
- ChromaDB

### Quick Start

1. **Clone and Install**
```bash
cd elara-platform
pnpm install
```

2. **Start Infrastructure Services**
```bash
docker-compose up -d
```

This starts:
- PostgreSQL on port 5432
- Redis on port 6379
- ChromaDB on port 8000

3. **Configure Environment**
```bash
cd packages/backend
cp .env.example .env
# Edit .env with your API keys
```

4. **Setup Database**
```bash
pnpm db:generate
pnpm db:migrate
```

5. **Start Development Servers**
```bash
# Start all services
pnpm dev

# Or start individually
pnpm backend:dev    # API on http://localhost:3001
pnpm frontend:dev   # Frontend on http://localhost:5173
pnpm admin:dev      # Admin on http://localhost:5174
```

## 🔑 API Keys Configuration

The platform requires the following API keys (already configured in `.env`):

```env
# AI Services
ANTHROPIC_API_KEY=sk-ant-api03-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
OPENAI_API_KEY=sk-proj-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
GOOGLE_AI_API_KEY=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/elara_db

# Redis
REDIS_PASSWORD=your-redis-password
```

## 📚 API Documentation

### Authentication Endpoints

#### Register
```http
POST /api/v2/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "organizationName": "Acme Corp"
}
```

#### Login
```http
POST /api/v2/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

### Scan Endpoints

#### URL Scan
```http
POST /api/v2/scan/url
Authorization: Bearer <token>
Content-Type: application/json

{
  "url": "https://example.com"
}
```

#### Message Scan
```http
POST /api/v2/scan/message
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "Your account has been suspended. Click here to verify...",
  "sender": "noreply@suspicious.com",
  "subject": "Account Verification Required"
}
```

#### File Scan
```http
POST /api/v2/scan/file
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <binary data>
```

#### Get Scans
```http
GET /api/v2/scans?page=1&limit=20&scanType=url&riskLevel=high
Authorization: Bearer <token>
```

#### Get Scan Details
```http
GET /api/v2/scans/:id
Authorization: Bearer <token>
```

### Dataset Endpoints (Admin Only)

#### Upload Dataset
```http
POST /api/v2/datasets
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: threat_data.csv
name: Phishing URLs Dataset
description: Collection of known phishing URLs
```

#### List Datasets
```http
GET /api/v2/datasets?page=1&status=ready&vectorized=true
Authorization: Bearer <token>
```

### AI Query Endpoint

```http
POST /api/v2/ai/query
Authorization: Bearer <token>
Content-Type: application/json

{
  "query": "Explain the risks of typosquatting attacks",
  "useRAG": true,
  "model": "claude"
}
```

## 🔒 Security Features

- **JWT Authentication** - 30min access tokens, 7-day refresh tokens
- **bcrypt Password Hashing** - 12 rounds
- **API Key Authentication** - For programmatic access
- **Role-Based Access Control** - User, Admin, Owner roles
- **Tier-Based Rate Limiting** - Free: 100/hr, Pro: 1000/hr, Enterprise: 10000/hr
- **Helmet.js Security Headers** - XSS, CSRF protection
- **Input Validation** - Zod schema validation
- **SQL Injection Prevention** - Prisma parameterized queries

## 📊 Database Schema

### Core Models
- **Organization** - Tenants with tier-based access
- **User** - Authenticated users with roles
- **ScanResult** - All scan results with risk scores
- **RiskCategory** - Category-specific threat scores
- **Dataset** - Uploaded threat intelligence data
- **DatasetEntry** - Vectorized dataset rows
- **AuditLog** - Complete audit trail
- **RefreshToken** - JWT refresh token management

## 🎨 Frontend Features

### User Portal
- **Home Dashboard** - Quick access to all scanners
- **URL Scanner** - Real-time URL validation and scanning
- **Message Scanner** - Multi-line text analysis
- **File Scanner** - Drag-and-drop file upload
- **Scan History** - Filterable, paginated scan results
- **Results Display** -
  - Risk score gauge (0-350)
  - Risk level badges
  - 13-category breakdown with progress bars
  - Detailed findings list
  - AI analysis section
  - Recommendations

### Admin Dashboard
- Organization management
- User management
- Dataset upload and vectorization
- System metrics and analytics
- API usage tracking

## 🚢 Deployment

### Docker Deployment
```bash
docker-compose up -d --build
```

### Kubernetes Deployment
```bash
kubectl apply -f infrastructure/k8s/
```

### GCP Deployment
```bash
cd infrastructure/terraform
terraform init
terraform plan
terraform apply
```

## 🔧 Development

### Available Scripts

```bash
# Development
pnpm dev                 # Start all services
pnpm backend:dev         # Backend only
pnpm frontend:dev        # Frontend only
pnpm admin:dev           # Admin only

# Database
pnpm db:generate         # Generate Prisma client
pnpm db:migrate          # Run migrations
pnpm db:studio           # Open Prisma Studio
pnpm db:push             # Push schema changes

# Build
pnpm build               # Build all packages

# Testing
pnpm test                # Run all tests
pnpm lint                # Lint all packages
```

### Project Structure

**Backend Services:**
- `src/services/scanners/` - URL, message, file scanners
- `src/services/ai/` - Multi-LLM AI service with RAG
- `src/services/dataset/` - Dataset management
- `src/services/queue/` - BullMQ job processing
- `src/controllers/` - API route controllers
- `src/middleware/` - Auth, rate limiting, validation
- `src/validators/` - Zod schemas

**Frontend Components:**
- `src/pages/` - Main application pages
- `src/components/` - Reusable React components
- `src/contexts/` - React context providers
- `src/lib/` - API client and utilities

## 📈 Performance

- **Async Processing** - BullMQ for background scan jobs
- **Caching** - Redis for API responses and session data
- **Vector Search** - ChromaDB for fast similarity queries
- **Connection Pooling** - Prisma connection management
- **Auto-scaling** - HPA for Kubernetes deployments

## 🐛 Logging & Monitoring

- **Winston Logger** - Structured logging with rotation
- **Audit Logs** - Complete database audit trail
- **Error Tracking** - Comprehensive error handling
- **API Metrics** - Request duration and status tracking

## 🔐 Data Privacy

- GDPR compliant data handling
- Encrypted data at rest and in transit
- Configurable data retention policies
- User data export capabilities

## 📝 License

Proprietary - All Rights Reserved

## 🤝 Support

For support, please contact: support@elara-security.com

## 🙏 Acknowledgments

- Anthropic Claude for AI analysis
- OpenAI GPT-4 for fallback AI
- Google Gemini for additional AI capabilities
- ChromaDB for vector database
- All open-source contributors

---

**Built with ❤️ for enterprise security**

Version: 1.0.0
Last Updated: October 2025
