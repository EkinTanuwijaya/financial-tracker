# Development Dockerfile for NestJS Backend
FROM node:20-alpine

WORKDIR /app

# Prisma needs OpenSSL on Alpine. Tesseract OCR for receipt processing.
# Sharp needs libvips for image preprocessing
RUN apk add --no-cache openssl libc6-compat tesseract-ocr tesseract-ocr-data-eng tesseract-ocr-data-ind vips-dev

# Install pnpm (corepack ships the correct binary for this platform)
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy package files and lockfiles
COPY package.json pnpm-lock.yaml* ./
COPY pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/
COPY packages/prisma/package.json ./packages/prisma/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma client
RUN pnpm --filter @finance-tracker/backend run db:generate -- --schema=../../packages/prisma/schema.prisma

EXPOSE 3001

CMD ["pnpm", "--filter", "@finance-tracker/backend", "run", "start:dev"]