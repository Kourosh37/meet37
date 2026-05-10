# meet37 frontend

React + Vite client for room lifecycle, LiveKit meeting, chat, whiteboard sync, and direct S3 file sharing.

## Environment

Create `frontend/.env`:

```bash
VITE_API_URL=/api
VITE_LK_URL=ws://localhost:7880
```

## Scripts

- `npm install`
- `npm run dev`
- `npm run build`

## Notes

- The app uses `public/logo.png` for favicon and in-app branding.
- In Docker Compose, frontend is built into an Nginx container and served behind the gateway Nginx service.
