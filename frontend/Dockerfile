FROM node:20-bookworm-slim AS builder
WORKDIR /app

ENV npm_config_fund=false \
    npm_config_audit=false \
    npm_config_update_notifier=false \
    npm_config_progress=false

COPY frontend/package.json frontend/package-lock.json ./
RUN npm config set registry https://registry.npmjs.org/ && npm install --include=dev --no-audit --no-fund

COPY frontend/ ./
ARG VITE_API_URL=/api
ARG VITE_LK_URL=ws://localhost/livekit
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_LK_URL=$VITE_LK_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
