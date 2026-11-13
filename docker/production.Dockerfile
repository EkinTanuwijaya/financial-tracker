FROM node:22-alpine AS dependencies
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat \
    && corepack enable && corepack prepare pnpm@9.0.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/dashboard/package.json ./apps/dashboard/
COPY packages/shared/package.json ./packages/shared/
COPY packages/prisma/package.json ./packages/prisma/
RUN pnpm install --frozen-lockfile
COPY tsconfig.base.json ./
COPY packages/prisma ./packages/prisma

FROM dependencies AS backend
COPY packages/shared ./packages/shared
COPY apps/backend/src ./apps/backend/src
COPY apps/backend/tsconfig.json ./apps/backend/
RUN pnpm --filter @finance-tracker/backend run db:generate \
    && pnpm --filter @finance-tracker/backend exec tsc -p tsconfig.json
ENV NODE_ENV=production PORT=3001
USER node
EXPOSE 3001
CMD ["node", "apps/backend/dist/main.js"]

FROM dependencies AS dashboard-build
COPY apps/dashboard ./apps/dashboard
COPY packages/shared ./packages/shared
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=""
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID \
    NEXT_TELEMETRY_DISABLED=1
RUN test -n "$NEXT_PUBLIC_API_URL" \
    && pnpm --filter @finance-tracker/dashboard run build

FROM node:22-alpine AS dashboard
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=dashboard-build --chown=node:node /app/apps/dashboard/.next/standalone ./
COPY --from=dashboard-build --chown=node:node /app/apps/dashboard/.next/static ./apps/dashboard/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/dashboard/server.js"]
