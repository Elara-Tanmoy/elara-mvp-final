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

# Copy root package files (for monorepo workspace)
COPY pnpm-lock.yaml package.json* ./

# Copy package-specific files
COPY ${PACKAGE_PATH}/package.json ./backend-package.json
COPY ${PACKAGE_PATH}/prisma ./prisma/

# Move backend package.json to correct location
RUN mv backend-package.json package.json

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY ${PACKAGE_PATH}/src ./src
COPY ${PACKAGE_PATH}/tsconfig.json* ./

# Generate Prisma Client
RUN pnpm prisma generate

# Build TypeScript
RUN pnpm build

# Remove dev dependencies
RUN pnpm prune --prod

# Stage 2: Production stage
FROM node:18-alpine AS production

# Install security updates and dumb-init
RUN apk update && apk upgrade && apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy built application from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma

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
