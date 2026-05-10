# meet37 frontend

React + Vite client for room creation, join flow, LiveKit meeting, chat, Yjs whiteboard sync, and direct S3 file sharing.

## Environment

Create `frontend/.env`:

```bash
VITE_API_URL=http://localhost:8080
VITE_LK_URL=ws://localhost:7880
```

## Scripts

- `npm install`
- `npm run dev`
- `npm run build`

## Implemented flows

- Create room (`POST /rooms`)
- Validate room token (`GET /rooms/:token`)
- Join room and connect to LiveKit (`POST /rooms/:token/join`)
- Chat over LiveKit data channel
- Whiteboard sync via Yjs updates over LiveKit data channel
- File sharing via presigned S3 upload URL (`POST /files/upload-url`)