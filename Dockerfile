# Multi-stage Docker build for SmartQA Hub

# Stage 1: Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Create necessary directories
RUN mkdir -p logs reports tests/visual/baselines tests/visual/output tests/visual/diffs

# Stage 2: Runtime stage
FROM node:18-alpine AS runtime

# Install system dependencies for Playwright
RUN apk add --no-cache \
    chromium \
    firefox \
    webkit2gtk \
    glib \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    && rm -rf /var/cache/apk/*

# Create app user
RUN addgroup -g 1001 -S smartqa && \
    adduser -S smartqa -u 1001

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=smartqa:smartqa /app .

# Set environment variables
ENV NODE_ENV=production
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_BROWSERS_PATH=/usr/bin

# Create volume mount points
VOLUME ["/app/logs", "/app/reports", "/app/tests/visual"]

# Switch to non-root user
USER smartqa

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["npm", "start"]

# Labels for metadata
LABEL maintainer="SmartQA Team <team@smartqa-hub.com>"
LABEL version="1.0.0"
LABEL description="SmartQA Hub - Innovative QA Testing Framework"
LABEL org.opencontainers.image.title="SmartQA Hub"
LABEL org.opencontainers.image.description="AI-powered QA testing framework with visual regression, API testing, and real-time analytics"
LABEL org.opencontainers.image.url="https://github.com/1234-ad/smartqa-hub"
LABEL org.opencontainers.image.source="https://github.com/1234-ad/smartqa-hub"
LABEL org.opencontainers.image.vendor="SmartQA Team"
LABEL org.opencontainers.image.licenses="MIT"