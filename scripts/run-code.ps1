# Create WebVPN Requirements Prompt
$prompt = @'
# BUILD: WebVPN Feature for Elara Security Platform

## WHAT WE'RE BUILDING
Add a secure web proxy feature that lets premium users browse any website safely through our platform. Users enter a URL, click "Connect", and the website loads in an isolated environment while hiding their real IP address and protecting them from threats.

---

## CURRENT PLATFORM

**Deployment:**
- Frontend: Vercel (React/Vite)
- Backend: Render.com (Node.js/Express) 
- We use monorepo structure with packages/backend and packages/frontend

**What exists now:**
- AI threat scanning for URLs and messages
- User dashboard with threat analysis tools
- Multi-LLM integration (GPT, Claude, Gemini)
- API endpoints for scanning and analysis

**What we need to add:**
A new "SecureVPN" feature that acts as a web proxy service

---

## USER EXPERIENCE REQUIREMENTS

**What the user sees:**
1. A "SecureVPN" widget appears in their dashboard
2. They enter any website URL (e.g., https://example.com)
3. They click "Connect" button
4. The website loads in a secure iframe on our platform
5. Live stats show: requests made, data transferred, session duration
6. They can disconnect anytime with one click
7. Everything is mobile-responsive

**What should NOT happen:**
- Users cannot access localhost or internal IPs (security risk)
- No access to .local, .internal, or .corp domains
- Session expires after 1 hour automatically

---

## TECHNICAL ARCHITECTURE NEEDED

**Three-Component System:**

1. **Proxy Service** (new microservice on Render)
   - Receives URL requests from users
   - Validates URLs for security
   - Fetches the website content
   - Returns it safely to our frontend
   - Must be deployed as separate Render service

2. **Backend API Routes** (extend existing backend)
   - Create/manage proxy sessions
   - Track usage statistics
   - Log all activity for security
   - Handle session lifecycle

3. **Frontend Component** (new React component)
   - User interface for entering URLs
   - Display connection status
   - Show usage statistics
   - Render proxied content in iframe

---

## FUNCTIONAL REQUIREMENTS

**Session Management:**
- Generate unique session ID when user clicks "Connect"
- Store session data: userId, start time, request count, bytes transferred
- Sessions expire after 1 hour or on manual disconnect
- Return final stats when session ends

**Security Validations:**
- Block all localhost addresses (127.0.0.1, localhost, 0.0.0.0)
- Block private IP ranges (10.x.x.x, 172.16.x.x, 192.168.x.x)
- Block internal domains (.local, .internal, .corp)
- Require authentication (session ID) for all proxy requests
- Set 30-second timeout on all proxied requests

**Logging & Monitoring:**
- Log every proxied request with: session ID, URL, timestamp, status
- Track bandwidth usage per session
- Count total requests per session
- Enable health check endpoints for monitoring

**User Feedback:**
- Show "Connecting..." state while establishing connection
- Display "Connected" status with green indicator
- Update stats every 5 seconds while connected
- Show error messages for blocked/invalid URLs
- Confirm disconnect with final session stats

---

## TECHNOLOGY CONSTRAINTS

**Must use:**
- Python Flask for proxy service (it's simple and effective)
- Docker for proxy service deployment
- Express.js routes for backend API (our existing pattern)
- React functional components for frontend (our existing pattern)
- Render.com free tier for deployment (cost constraint)

**Must NOT use:**
- No paid VPN APIs or services
- No commercial proxy services
- No sales team contact required
- No API keys from external services

**File Organization:**
- Proxy service: `packages/proxy-service/`
- Backend routes: `packages/backend/src/routes/proxy.js`
- Frontend component: `packages/frontend/src/components/SecureVPN.jsx`

---

## DEPLOYMENT REQUIREMENTS

**Render Configuration:**
- Add new service definition to render.yaml
- Name it "elara-proxy"
- Use Docker environment
- Health check at /health endpoint
- Connect it to existing backend via environment variable

**Environment Variables Needed:**
- Backend needs: PROXY_SERVICE_URL (points to proxy service)
- Proxy service needs: CORS_ORIGIN (Vercel URL), PORT (8080)

**Integration Points:**
- Backend must import and register new proxy routes
- Frontend dashboard must import and display SecureVPN component
- Both must use existing environment variable patterns

---

## SUCCESS CRITERIA

**Feature works when:**
1. User can type URL and click Connect
2. Valid websites load and display in iframe
3. Stats update in real-time (requests, data, time)
4. Disconnect button ends session cleanly
5. Localhost/internal URLs are blocked with error message
6. Works on mobile devices
7. No console errors in browser
8. All health checks return 200 OK
9. Can deploy to production without issues

**Code quality requirements:**
- Follow existing code patterns in the project
- Include error handling for all operations
- Add clear comments for complex logic
- Use async/await for asynchronous operations
- Implement proper CORS configuration
- Handle edge cases gracefully

---

## WHAT TO BUILD

Generate complete, production-ready implementations for:

1. **Proxy Service** - Flask app that safely forwards web requests
2. **Backend API** - Express routes for session management
3. **Frontend Component** - React component for user interface
4. **Configuration Files** - Dockerfile, requirements.txt, updated render.yaml
5. **Integration Code** - Updates to existing files to wire everything together

Make all code production-ready with proper error handling, security validations, and user-friendly messages.

---

## IMPORTANT NOTES

- This is a REAL production feature, not a prototype
- Security is critical - validate everything
- User experience must be smooth and intuitive
- Must work with our existing Vercel + Render deployment
- Code should match our existing project structure and patterns
- Think through edge cases and handle them gracefully

---

START IMPLEMENTATION - Generate all necessary files and code.
'@

Set-Content -Path "WEBVPN_PROMPT.md" -Value $prompt -Encoding UTF8

