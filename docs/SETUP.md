# Elara Platform - Setup Guide

## Quick Start (5 minutes)

### 1. Prerequisites Check
```bash
node --version  # Should be 18+
pnpm --version  # Should be 8+
docker --version
docker-compose --version
```

### 2. Start Infrastructure
```bash
# From elara-platform directory
docker-compose up -d

# Verify services are running
docker-compose ps
```

You should see:
- ✓ elara-postgres (port 5432)
- ✓ elara-redis (port 6379)
- ✓ elara-chromadb (port 8000)

### 3. Install Dependencies
```bash
pnpm install
```

### 4. Setup Backend Database
```bash
cd packages/backend

# Generate Prisma client
pnpm db:generate

# Run migrations
pnpm db:migrate

# Go back to root
cd ../..
```

### 5. Start Development Servers
```bash
# Option A: Start all services together
pnpm dev

# Option B: Start individually in separate terminals
pnpm backend:dev    # Terminal 1 - http://localhost:3001
pnpm frontend:dev   # Terminal 2 - http://localhost:5173
pnpm admin:dev      # Terminal 3 - http://localhost:5174
```

### 6. Test the Platform

**Frontend:** http://localhost:5173
1. Click "Sign up"
2. Create account:
   - First Name: John
   - Last Name: Doe
   - Organization: Test Corp
   - Email: john@test.com
   - Password: TestPass123!

3. After login, try scanning:
   - URL Scanner: https://example.com
   - Message Scanner: Paste a test email
   - File Scanner: Upload an image

**API:** http://localhost:3001/api/health
```bash
curl http://localhost:3001/api/health
# Response: {"status":"ok","timestamp":"..."}
```

## Troubleshooting

### Database Connection Issues
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# View PostgreSQL logs
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres

# Reset database (WARNING: Deletes all data)
cd packages/backend
pnpm db:push --force-reset
```

### Redis Connection Issues
```bash
# Check Redis
docker-compose ps redis

# Test Redis connection
docker-compose exec redis redis-cli -a elara_redis_pass ping
# Response: PONG

# View Redis logs
docker-compose logs redis
```

### ChromaDB Issues
```bash
# Check ChromaDB
docker-compose ps chromadb

# Test ChromaDB
curl http://localhost:8000/api/v1/heartbeat
# Response: {"status":"ok"}

# View ChromaDB logs
docker-compose logs chromadb
```

### Port Already in Use
```bash
# Check what's using the port
# Windows
netstat -ano | findstr :3001
netstat -ano | findstr :5173

# macOS/Linux
lsof -i :3001
lsof -i :5173

# Kill the process or change port in:
# - packages/backend/.env (PORT=3001)
# - packages/frontend/vite.config.ts (port: 5173)
```

### Prisma Client Not Found
```bash
cd packages/backend
pnpm db:generate
```

### Module Not Found Errors
```bash
# Clean install
rm -rf node_modules packages/*/node_modules
pnpm install
```

## Development Workflow

### Making Code Changes

**Backend:**
- Edit files in `packages/backend/src/`
- Server auto-restarts with tsx watch
- Check logs in terminal

**Frontend:**
- Edit files in `packages/frontend/src/`
- Browser auto-reloads with Vite HMR
- Check browser console

### Database Changes

1. Edit schema: `packages/backend/prisma/schema.prisma`
2. Create migration:
   ```bash
   cd packages/backend
   pnpm db:migrate
   ```
3. Schema changes are applied automatically

### Adding New Dependencies

```bash
# Backend
cd packages/backend
pnpm add <package>

# Frontend
cd packages/frontend
pnpm add <package>

# Shared
cd packages/shared
pnpm add <package>
```

## Testing Scanners

### URL Scanner Tests
```bash
# Test with safe URL
curl -X POST http://localhost:3001/api/v2/scan/url \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://google.com"}'

# Test with suspicious URL (will score higher)
curl -X POST http://localhost:3001/api/v2/scan/url \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"http://suspicious-login-verify.tk"}'
```

### Message Scanner Tests
```bash
curl -X POST http://localhost:3001/api/v2/scan/message \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "URGENT: Your account has been suspended. Click here to verify your credentials immediately!",
    "sender": "noreply@security-verify.com",
    "subject": "Account Suspended - Action Required"
  }'
```

### File Scanner Tests
```bash
# Upload a test image
curl -X POST http://localhost:3001/api/v2/scan/file \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test-image.png"
```

## Production Deployment

### Environment Variables
Create production `.env` files:

**Backend (.env.production):**
```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@prod-host:5432/elara_db
REDIS_HOST=prod-redis-host
JWT_SECRET=YOUR_SECURE_SECRET_HERE
# ... other variables
```

### Build for Production
```bash
pnpm build
```

### Docker Build
```bash
# Backend
cd packages/backend
docker build -t elara-backend:latest .

# Frontend
cd packages/frontend
docker build -t elara-frontend:latest .
```

### Deploy to GCP
```bash
cd infrastructure/terraform
terraform init
terraform plan -var="project_id=YOUR_GCP_PROJECT"
terraform apply
```

### Deploy to Kubernetes
```bash
# Configure kubectl
gcloud container clusters get-credentials elara-cluster --region us-central1

# Apply manifests
kubectl apply -f infrastructure/k8s/

# Check deployment
kubectl get pods
kubectl get services
```

## Monitoring

### View Logs
```bash
# Backend logs
tail -f packages/backend/logs/combined.log
tail -f packages/backend/logs/error.log

# Docker logs
docker-compose logs -f backend
```

### Database Studio
```bash
cd packages/backend
pnpm db:studio
# Opens at http://localhost:5555
```

### Redis CLI
```bash
docker-compose exec redis redis-cli -a elara_redis_pass
> KEYS *
> GET ratelimit:*
```

## Common Tasks

### Reset Everything
```bash
# Stop all services
docker-compose down -v

# Clean dependencies
rm -rf node_modules packages/*/node_modules

# Reinstall
pnpm install

# Restart infrastructure
docker-compose up -d

# Reset database
cd packages/backend
pnpm db:push --force-reset
```

### Create Admin User
```bash
# Use Prisma Studio
pnpm db:studio

# Or via SQL
docker-compose exec postgres psql -U elara -d elara_db
UPDATE "User" SET role = 'admin' WHERE email = 'your@email.com';
```

### Check API Usage
```bash
# View rate limit keys in Redis
docker-compose exec redis redis-cli -a elara_redis_pass KEYS "ratelimit:*"
```

## Support

If you encounter issues:
1. Check logs: `packages/backend/logs/`
2. Check Docker: `docker-compose logs`
3. Check database: `pnpm db:studio`
4. Check Redis: `docker-compose exec redis redis-cli -a elara_redis_pass`
5. Reset and retry: Follow "Reset Everything" section

## Next Steps

1. ✓ Platform is running
2. Create test scans to verify functionality
3. Upload test datasets for RAG
4. Configure production API keys
5. Set up monitoring and alerting
6. Deploy to cloud infrastructure

Happy scanning! 🛡️
