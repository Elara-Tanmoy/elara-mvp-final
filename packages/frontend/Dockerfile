# Multi-stage Dockerfile for Elara Frontend (Production)
# Supports monorepo structure with root build context

# Stage 1: Build stage
FROM node:20-alpine AS builder

# Build arg for package path (defaults to packages/frontend for monorepo)
ARG PACKAGE_PATH=packages/frontend

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

# Install dependencies for frontend package only
RUN pnpm install --frozen-lockfile --filter=frontend

# Copy source code into workspace structure
COPY ${PACKAGE_PATH} ./packages/frontend/

# Build application
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN pnpm --filter=frontend build

# Stage 2: Production stage with Nginx
FROM nginx:alpine AS production

# Install security updates
RUN apk update && apk upgrade

# Copy built application from builder (from workspace structure)
COPY --from=builder /app/packages/frontend/dist /usr/share/nginx/html

# Copy nginx configuration from package directory
COPY ${PACKAGE_PATH}/nginx.conf /etc/nginx/conf.d/default.conf

# Create non-root user
RUN addgroup -g 1001 -S nginx && adduser -S nginx -u 1001 -G nginx

# Set proper permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# Switch to non-root user
USER nginx

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
