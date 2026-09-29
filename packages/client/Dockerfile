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

# Build shared package
WORKDIR /app/packages/shared
RUN pnpm build

# Build client package
WORKDIR /app/packages/client
RUN pnpm build

# Install serve for production
RUN npm install -g serve

# Set environment
ENV NODE_ENV=production

# Expose port
EXPOSE 5173

# Start serving the built client
CMD ["serve", "-s", "dist", "-l", "5173"]
