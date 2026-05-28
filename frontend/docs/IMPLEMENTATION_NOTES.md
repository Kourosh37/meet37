# Implementation Notes

## Dependency Choices

- Radix packages are installed directly so shadcn/ui components can be added without changing the underlying primitive stack.
- `sonner` is included for toast feedback in meeting, auth, file-transfer, and admin flows.
- `date-fns` is included for formatting backend Unix timestamps.
- `uuid` is included for frontend-generated file transfer IDs and temporary client-side correlation IDs.
- `@hookform/resolvers` is included to connect zod schemas to react-hook-form.
- `pnpm` is the only package manager for this workspace; keep `pnpm-lock.yaml` authoritative and do not regenerate alternate package-manager lockfiles.
- Vitest replaces Jest to match the architecture document and keep unit tests fast.

## Audit Notes

After installing dependencies, direct high/critical advisories were resolved by upgrading Next, Axios, Playwright, ESLint, PostCSS, and uuid.

Security review should be run through the pnpm toolchain. Next currently pins an internal PostCSS dependency separately from the project's direct `postcss@8.5.15`; do not use forced automated audit fixes from another package manager because they can rewrite the lockfile and propose incompatible Next changes. Re-check this after the next patched Next release.

## Performance Notes

- Meeting room UI should be a client-only feature boundary because it depends on `window`, media devices, WebSocket, and WebRTC.
- Keep video tile dimensions stable with CSS aspect ratios before attaching streams.
- Use React Query stale times for room list, chat history, file history, and admin stats instead of manual polling in components.
- Avoid storing `MediaStream` objects in persisted stores.

## Security Notes

- Keep access tokens in memory and mirror to `sessionStorage` only when refresh recovery is required.
- Never store `host_token` in URLs or logs.
- Redact SDP, ICE candidates, tokens, and host tokens in frontend debug logs.
- Do not use `dangerouslySetInnerHTML` for chat or display names.
