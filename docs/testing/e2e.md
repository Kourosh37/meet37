# End-To-End Testing

E2E tests live in:

```text
frontend/tests/e2e/
```

The Playwright config is:

```text
frontend/playwright.config.ts
```

## Run

```bash
cd frontend
pnpm test:e2e
```

## Server

Playwright starts:

```bash
pnpm dev --hostname 127.0.0.1 --port 3001
```

Default base URL:

```text
http://127.0.0.1:3001
```

Override:

```bash
FRONTEND_BASE_URL=https://meet.example.com pnpm test:e2e
```

## Projects

- Desktop Chromium.
- Desktop Firefox.

## Media Testing Notes

Automated browser tests can mock media APIs, but they do not fully prove production WebRTC behavior. Production validation still needs manual tests with real devices, HTTPS, WebSocket, and UDP media ports.

## Recommended E2E Coverage

- Landing page renders.
- Room creation form creates a room.
- Room password modal handles protected rooms.
- Pre-join display name validation.
- Duplicate display name failure.
- Approval-mode waiting room.
- Meeting controls render and toggle states.
- Chat message send and history load.
- File offer and metadata state.
- Admin login and settings update.
- Mobile viewport layout.
