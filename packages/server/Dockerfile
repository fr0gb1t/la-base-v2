FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@latest

# Copy root package files first
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc* ./

# Copy all packages
COPY packages ./packages

# Install all dependencies for the entire monorepo
RUN pnpm install --frozen-lockfile

# Verify dependencies installed
RUN ls -la node_modules/.pnpm | head -20

# Build shared package
WORKDIR /app/packages/shared
RUN pnpm build

# Build server package
WORKDIR /app/packages/server
RUN pnpm build

# Set environment
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Run server
CMD ["node", "dist/index.js"]
