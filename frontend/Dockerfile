FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS builder
WORKDIR /app
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_TURN_PUBLIC_IP
ARG BACKEND_INTERNAL_URL
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_TURN_PUBLIC_IP=$NEXT_PUBLIC_TURN_PUBLIC_IP
ENV BACKEND_INTERNAL_URL=$BACKEND_INTERNAL_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN ./node_modules/.bin/next build

FROM node:22-alpine AS runner
WORKDIR /app
ARG BACKEND_INTERNAL_URL
ARG FRONTEND_PORT
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV BACKEND_INTERNAL_URL=$BACKEND_INTERNAL_URL
ENV PORT=$FRONTEND_PORT
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=5 CMD wget -qO- "${FRONTEND_HEALTHCHECK_URL}" || exit 1
CMD ["node", "server.js"]
