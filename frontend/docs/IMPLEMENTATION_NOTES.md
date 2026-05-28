# Implementation Notes

## Dependency Choices

- Radix packages are installed directly so shadcn/ui components can be added without changing the underlying primitive stack.
- `sonner` is included for toast feedback in meeting, auth, file-transfer, and admin flows.
- `date-fns` is included for formatting backend Unix timestamps.
- `uuid` is included for frontend-generated file transfer IDs and temporary client-side correlation IDs.
- `@hookform/resolvers` is included to connect zod schemas to react-hook-form.

## Audit Notes

After installing dependencies, direct high/critical advisories were resolved by upgrading Next, Axios, Playwright, ESLint, PostCSS, and uuid.

`npm audit` still reports a moderate advisory through Next's bundled `postcss@8.4.31`. The project also has a direct `postcss@8.5.15`, but Next currently pins its internal PostCSS dependency exactly. Do not apply `npm audit fix --force`; npm proposes a major downgrade to old Next versions. Re-check this after the next patched Next release.

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
