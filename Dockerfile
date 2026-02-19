# --- Stage 1: Dependencies ---
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm ci

# --- Stage 2: Build ---
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma generate + Next.js build (standalone output)
RUN npx prisma generate && npm run build

# --- Stage 3: Production ---
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

# Prisma requires OpenSSL at runtime
RUN apk add --no-cache openssl

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy prisma schema + migrations + engine for runtime migrate deploy
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Entrypoint: run migrations then start server
COPY --chown=nextjs:nodejs entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

USER nextjs

EXPOSE 8080

ENTRYPOINT ["./entrypoint.sh"]
