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

# Copy root package files (for monorepo workspace)
COPY pnpm-lock.yaml package.json* ./

# Copy package-specific files
COPY ${PACKAGE_PATH}/package.json ./frontend-package.json

# Move frontend package.json to correct location
RUN mv frontend-package.json package.json

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY ${PACKAGE_PATH}/. .

# Build application
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN pnpm build

# Stage 2: Production stage with Nginx
FROM nginx:alpine AS production

# Install security updates
RUN apk update && apk upgrade

# Copy built application from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

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
