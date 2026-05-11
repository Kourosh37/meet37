FROM node:20-bookworm AS deps
WORKDIR /app

ENV npm_config_fund=false \
	npm_config_audit=false \
	npm_config_update_notifier=false \
	npm_config_progress=false


COPY package.json package-lock.json* ./
RUN npm install --include=dev --no-audit --no-fund

FROM deps AS build
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
RUN npm run prisma:generate
RUN npm run build

FROM node:20-bookworm
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
