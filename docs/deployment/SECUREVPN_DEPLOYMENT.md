# SecureVPN Browser - Deployment Guide

## Overview

The SecureVPN Browser is a premium web proxy feature that allows users to browse websites securely through Elara's protected infrastructure. This guide covers deployment, configuration, and troubleshooting.

## Architecture

The feature consists of three main components:

### 1. Proxy Service (Python Flask)
- **Location**: `packages/proxy-service/`
- **Runtime**: Python 3.11 + Flask
- **Deployment**: Render.com (Docker)
- **URL**: https://elara-proxy.onrender.com

### 2. Backend API (Node.js/Express)
- **Location**: `packages/backend/src/controllers/proxy.controller.ts`
- **Runtime**: Node.js 20.x
- **Deployment**: Render.com
- **URL**: https://elara-backend-64tf.onrender.com

### 3. Frontend Component (React)
- **Location**: `packages/frontend/src/components/SecureVPN.tsx`
- **Runtime**: Vite + React
- **Deployment**: Vercel
- **URL**: https://elara-7c108p1d1-tanmoys-projects-1b158c68.vercel.app

## Deployment Steps

### Step 1: Deploy Proxy Service to Render

The proxy service is automatically deployed when you push to GitHub because it's configured in `render.yaml`.

**Manual deployment (if needed):**

1. Go to https://render.com
2. Create new Web Service
3. Connect to GitHub repository
4. Configure:
   - **Name**: elara-proxy
   - **Runtime**: Docker
   - **Branch**: main
   - **Root Directory**: packages/proxy-service
   - **Docker Command**: (auto-detected from Dockerfile)

5. Environment Variables:
   ```
   PORT=8080
   CORS_ORIGIN=https://elara-7c108p1d1-tanmoys-projects-1b158c68.vercel.app
   ```

6. Deploy!

### Step 2: Update Backend Environment Variable

Make sure the backend has the proxy service URL:

1. Go to Render dashboard → elara-backend service
2. Add environment variable:
   ```
   PROXY_SERVICE_URL=https://elara-proxy.onrender.com
   ```
3. Redeploy backend

### Step 3: Run Database Migration

The ProxySession and ProxyRequest tables need to be created:

```bash
cd packages/backend
npx prisma db push
```

Or from production:
- Render will automatically run `npx prisma db push` on deployment (configured in render.yaml)

### Step 4: Verify Deployment

**Check Proxy Service Health:**
```bash
curl https://elara-proxy.onrender.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "elara-proxy",
  "timestamp": "2025-10-08T23:00:00.000Z"
}
```

**Check Backend Health:**
```bash
curl https://elara-backend-64tf.onrender.com/health
```

**Test Full Flow:**
1. Login to Elara platform (Premium or Admin user)
2. Navigate to Home page
3. SecureVPN Browser widget should appear
4. Enter URL: `https://example.com`
5. Click "Connect"
6. Website should load in iframe
7. Stats should update every 5 seconds

## Database Schema

### ProxySession Table
```prisma
model ProxySession {
  id              String   @id @default(cuid())
  userId          String
  sessionToken    String   @unique @default(cuid())
  targetUrl       String
  status          String   @default("active")
  requestCount    Int      @default(0)
  bytesTransferred BigInt  @default(0)
  startedAt       DateTime @default(now())
  endedAt         DateTime?
  lastActivityAt  DateTime @default(now())
  metadata        Json     @default("{}")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### ProxyRequest Table
```prisma
model ProxyRequest {
  id              String   @id @default(cuid())
  sessionToken    String
  requestUrl      String
  method          String   @default("GET")
  statusCode      Int?
  bytesTransferred BigInt  @default(0)
  responseTime    Int?
  success         Boolean  @default(true)
  errorMessage    String?
  timestamp       DateTime @default(now())
}
```

## API Endpoints

### Proxy Service

**POST /proxy**
```json
Request:
{
  "url": "https://example.com",
  "sessionId": "abc123"
}

Response:
{
  "success": true,
  "content": "HTML content...",
  "statusCode": 200,
  "headers": {},
  "contentLength": 1234,
  "finalUrl": "https://example.com"
}
```

**POST /validate**
```json
Request:
{
  "url": "https://example.com"
}

Response:
{
  "success": true,
  "valid": true,
  "url": "https://example.com"
}
```

### Backend API

**POST /api/v2/proxy/session**
Create a new proxy session
- Auth: Required
- Rate Limited: Yes

**GET /api/v2/proxy/session/:sessionToken**
Get session details
- Auth: Required

**POST /api/v2/proxy/request**
Make a proxied request
- Auth: Required
- Rate Limited: Yes

**POST /api/v2/proxy/session/:sessionToken/disconnect**
Disconnect a session
- Auth: Required

**GET /api/v2/proxy/sessions**
Get user's session history
- Auth: Required

**GET /api/v2/proxy/session/:sessionToken/stats**
Get session statistics
- Auth: Required

## Security Features

### URL Validation
- Blocks localhost (127.0.0.1, localhost, 0.0.0.0)
- Blocks private IP ranges (10.x.x.x, 172.16.x.x, 192.168.x.x)
- Blocks internal domains (.local, .internal, .corp)
- Only allows HTTP/HTTPS protocols

### Session Security
- Session-based authentication
- 1-hour automatic expiration
- Maximum 3 concurrent sessions per user
- Unique session tokens (CUID)

### Request Security
- 30-second timeout on all requests
- 10MB maximum response size
- Header sanitization
- SSL certificate verification
- Rate limiting per tier

## Monitoring

### Health Checks
- Proxy Service: `GET /health`
- Backend: `GET /api/health`

### Logs
Check Render logs for:
- Proxy service: Render dashboard → elara-proxy → Logs
- Backend: Render dashboard → elara-backend → Logs

### Metrics
Track in database:
- Active sessions: `SELECT COUNT(*) FROM ProxySession WHERE status = 'active'`
- Total requests today: `SELECT COUNT(*) FROM ProxyRequest WHERE timestamp > CURRENT_DATE`
- Average response time: `SELECT AVG(responseTime) FROM ProxyRequest WHERE success = true`

## Troubleshooting

### Issue: Proxy service not responding

**Check:**
1. Service health: `curl https://elara-proxy.onrender.com/health`
2. Render logs for errors
3. Environment variables are set correctly

**Solution:**
- Redeploy proxy service
- Check Docker build logs
- Verify Python dependencies

### Issue: "Session expired" error

**Cause:** Session older than 1 hour

**Solution:**
- User needs to create new session
- Click "Connect" again with new URL

### Issue: "Maximum concurrent sessions reached"

**Cause:** User has 3 active sessions

**Solution:**
- Disconnect one of the existing sessions
- Sessions auto-expire after 1 hour

### Issue: "Access to localhost is not allowed"

**Cause:** User trying to access blocked URL

**Solution:**
- This is expected security behavior
- Only public URLs are allowed

### Issue: Stats not updating

**Check:**
1. Browser console for errors
2. Network tab for failed API calls
3. Session token is valid

**Solution:**
- Refresh page
- Reconnect session

## Configuration

### Environment Variables

**Proxy Service:**
```
PORT=8080
CORS_ORIGIN=https://your-frontend-url.vercel.app
```

**Backend:**
```
PROXY_SERVICE_URL=https://elara-proxy.onrender.com
```

### Rate Limits

Configured per tier in database:
- Free: Limited by tier-based rate limiter
- Premium: Higher limits
- Enterprise: Highest limits

## Performance Optimization

### Proxy Service
- Uses Gunicorn with 2 workers
- Request timeout: 30 seconds
- Response size limit: 10MB
- In-memory request handling

### Backend
- Connection pooling for database
- Session caching
- Rate limiting to prevent abuse

### Frontend
- Stats update interval: 5 seconds
- Iframe sandbox for security
- Lazy loading of proxy content

## Future Improvements

1. **WebSocket support** for real-time data
2. **Request history** per session
3. **Custom headers** support
4. **Multiple tab support** in single session
5. **Bandwidth usage charts**
6. **PDF/Image viewer** for specific content types
7. **Session sharing** between users
8. **Proxy chaining** for enhanced anonymity

## Support

For issues or questions:
1. Check Render logs
2. Review browser console
3. Test health endpoints
4. Verify environment variables
5. Check database tables exist

## License

Part of Elara Security Platform - Internal Use Only
