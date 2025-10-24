# Multi-stage Dockerfile for Elara Backend (Production)
# Supports monorepo structure with root build context

# Stage 1: Build stage
FROM node:18-alpine AS builder

# Build arg for package path (defaults to packages/backend for monorepo)
ARG PACKAGE_PATH=packages/backend

# Set working directory
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy all workspace package.json files
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/proxy-service/package.json ./packages/proxy-service/
COPY packages/admin/package.json* ./packages/admin/
COPY packages/blockchain/package.json* ./packages/blockchain/
COPY packages/browser-extension/package.json* ./packages/browser-extension/

# Copy prisma schema (needed before install)
COPY ${PACKAGE_PATH}/prisma ./packages/backend/prisma/

# Install dependencies for backend package only
RUN pnpm install --frozen-lockfile --filter=backend

# Copy source code into workspace structure
COPY ${PACKAGE_PATH}/src ./packages/backend/src
COPY ${PACKAGE_PATH}/tsconfig.json* ./packages/backend/

# Generate Prisma Client for backend
RUN pnpm --filter=backend prisma generate

# Build TypeScript for backend
RUN pnpm --filter=backend build

# Remove dev dependencies from entire workspace
RUN pnpm --filter=backend --prod deploy pruned

# Stage 2: Production stage
FROM node:18-alpine AS production

# Install security updates and dumb-init
RUN apk update && apk upgrade && apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy built application from builder (from workspace structure)
COPY --from=builder --chown=nodejs:nodejs /app/packages/backend/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/pruned/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/pruned/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/packages/backend/prisma ./prisma

# Create necessary directories with proper permissions
RUN mkdir -p /app/logs /app/uploads && \
    chown -R nodejs:nodejs /app

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "dist/index.js"]
