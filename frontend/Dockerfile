FROM node:20-alpine AS builder
WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm config set fund false \
    && npm config set audit false \
    && npm ci --no-audit --no-fund

COPY frontend/ ./
ARG VITE_API_URL=/api
ARG VITE_LK_URL=ws://localhost/livekit
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_LK_URL=$VITE_LK_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY infra/frontend-nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80