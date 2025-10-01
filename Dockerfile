# Use Node.js 24 LTS as base image
FROM node:24-alpine

# Install build dependencies for native modules and Python for mcp-proxy
RUN apk add --no-cache python3 make g++ py3-pip netcat-openbsd

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install pnpm globally
RUN npm install -g pnpm

# Install mcp-proxy directly with --break-system-packages
RUN pip install --break-system-packages mcp-proxy

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

# Expose port for mcp-proxy streamable HTTP server
EXPOSE 8096

# Set the default command to run the MCP server via mcp-proxy
CMD ["mcp-proxy", "--port=8096", "--host=0.0.0.0", "--transport=http", "node", "dist/index.cjs"]


