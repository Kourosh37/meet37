# Meet Frontend

Next.js frontend for the meeting product. It connects to the Go backend for auth, room creation,
admin workflows, room metadata, chat/file metadata, WebSocket signaling, P2P WebRTC, and SFU
fallback signals.

## Requirements

- Node.js 22
- pnpm 10
- A running backend API
- Chromium/Firefox for E2E tests when running Playwright

## Environment

Copy `.env.example` to `.env` or provide these variables in the shell:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws
```

Both variables are public browser configuration. Do not put secrets in frontend env vars.

## Commands

```bash
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e --project=chromium
pnpm build
```

Install Playwright browsers once before E2E:

```bash
node node_modules/@playwright/test/cli.js install chromium
```

## Docker

Build and run the production image:

```bash
docker build -t meet-frontend .
docker run --rm -p 3000:3000 \
  -e NEXT_PUBLIC_API_BASE_URL=http://localhost:8080 \
  -e NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws \
  meet-frontend
```

Or use:

```bash
cd ..
docker compose up --build
```

## Browser Notes

- Camera and microphone require HTTPS in production, except localhost.
- WebRTC P2P quality depends on NAT traversal. The backend can trigger SFU fallback.
- File bytes transfer through WebRTC DataChannel after metadata is signaled through WebSocket.
- E2E tests install media mocks so CI does not need real camera or microphone devices.
