# Development Dockerfile for Next.js Dashboard
FROM node:20-alpine

WORKDIR /app

# Prisma needs OpenSSL on Alpine
RUN apk add --no-cache openssl libc6-compat

# Install pnpm (corepack ships the correct binary for this platform)
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy package files
COPY package.json pnpm-lock.yaml* ./
COPY pnpm-workspace.yaml ./
COPY apps/dashboard/package.json ./apps/dashboard/
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/
COPY packages/prisma/package.json ./packages/prisma/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

EXPOSE 3000

CMD ["pnpm", "--filter", "@finance-tracker/dashboard", "run", "dev"]