<p align="center">
  <img src="frontend/public/icons/meet37-logo-dark.svg" alt="Meet37" width="120" />
</p>

<h1 align="center">Meet37</h1>

<p align="center">
  <a href="https://meet.dev37.ir"><img src="https://readme-typing-svg.demolab.com?font=Inter&weight=700&size=22&duration=2800&pause=900&color=2563EB&center=true&vCenter=true&width=520&lines=Modern+open-source+video+meetings;Fast%2C+clean%2C+privacy-minded+rooms;Built+for+real-time+collaboration" alt="Meet37 animated intro" /></a>
</p>

<p align="center">
  <a href="https://meet.dev37.ir"><img src="https://img.shields.io/badge/Live-meet.dev37.ir-2563eb?style=for-the-badge" alt="Live website" /></a>
  <img src="https://img.shields.io/badge/License-AGPL--3.0-111827?style=for-the-badge" alt="AGPL-3.0 license" />
  <img src="https://img.shields.io/badge/Open%20Source-Always-16a34a?style=for-the-badge" alt="Always open source" />
</p>

Meet37 is a polished open-source video meeting app focused on quick room creation, clean pre-join controls, real-time chat, file sharing, reactions, notifications, and a responsive meeting experience across desktop and mobile.

Website: [meet.dev37.ir](https://meet.dev37.ir)

## Highlights

- Instant meeting rooms with a simple setup flow
- Camera, microphone, screen share, chat, reactions, and file attachments
- Mobile-friendly meeting controls and responsive room layout
- Real-time signaling and media flow designed for live collaboration
- Modern notification and sound system with user controls
- Docker-ready deployment for production environments

## Technical Architecture

Meet37 is split into a real-time backend and a modern frontend:

- **Frontend:** Next.js, React, TypeScript, responsive UI, room/pre-join flows, chat, file UI, notification and sound controls
- **Backend:** Go API server with room, signaling, middleware, database, and SFU-related internals
- **Real-time layer:** WebSocket signaling coordinates participants, chat events, reactions, device state, and room updates
- **Media layer:** WebRTC handles live audio/video streams, with SFU-oriented backend structure for scalable meetings
- **Deployment:** Docker Compose, Caddy, and production compose files are included for self-hosting

## Quick Start

```bash
docker compose up -d --build
```

Frontend development:

```bash
cd frontend
pnpm install
pnpm dev
```

Backend development:

```bash
cd backend
go build ./cmd/server
```

## Contributing

Contributions, ideas, bug reports, and improvements are welcome.

Telegram: [@kourosh_37](https://t.me/kourosh_37)

## License

Meet37 is licensed under the **GNU Affero General Public License v3.0 only**.

This project must remain open source. If you modify, run, host, or distribute it, follow the AGPL-3.0 requirements and keep the corresponding source code available.
