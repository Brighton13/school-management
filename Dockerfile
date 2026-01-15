# Base image (Debian, works with Prisma)
FROM node:18-bullseye AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# Build stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# Production stage
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system nodejs && adduser --system --ingroup nodejs nextjs

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma

USER nextjs

EXPOSE 3000
CMD ["npm", "start"]

