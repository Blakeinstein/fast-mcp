# Use Node.js 24 LTS as base image
FROM node:24-alpine

# Install build dependencies for native modules
RUN apk add --no-cache make g++ netcat-openbsd

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install pnpm globally
RUN npm install -g pnpm

# Install dependencies (including native modules)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm run build

# Make the built file executable
RUN chmod +x dist/index.cjs

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S mcp -u 1001

# Change ownership of the app directory to the nodejs user
RUN chown -R mcp:nodejs /app
USER mcp

# Expose port for HTTP server
EXPOSE 3000

# Set the default command to run the HTTP server directly
CMD ["node", "dist/index.cjs"]


