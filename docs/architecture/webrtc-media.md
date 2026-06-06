# WebRTC And Media

meet37 uses WebRTC for real-time camera, microphone, screen sharing, and data channels. The backend does not proxy normal HTTP media. It coordinates signaling and can provide SFU/media coordination through Pion WebRTC. Production deployments should run coturn for TURN relay and keep Caddy limited to HTTPS/WSS reverse proxy traffic.

## Media Lifecycle

1. A participant joins a room over `/ws`.
2. The frontend creates peer connections for existing peers and future peers.
3. Local audio/video/screen tracks are added or replaced on peer connections.
4. The frontend sends `offer`, `answer`, and `ice-candidate` messages through the backend.
5. Remote peers receive tracks through `ontrack`.
6. Tile state changes from loading to ready when the expected stream is attached and rendering.
7. The frontend periodically sends connection stats.
8. The backend may trigger `sfu-switch` when stats indicate poor connectivity or when the configured room peer threshold is reached.
9. The frontend keeps direct peer media available as a fallback while SFU negotiation completes, so media is not dropped during the transition.

## Camera

Camera capture uses `navigator.mediaDevices.getUserMedia`. Device selection is handled in pre-join and meeting media hooks. When the camera starts, the local media state should move to `starting`, then `ready` after the track is available. Remote clients receive `media-state` first and may show loading before the video track arrives.

Camera rendering should use fit behavior where required by the UI so mobile and maximized views do not crop important content.

## Microphone

Microphone capture uses `getUserMedia` audio tracks. Audio tracks are sent through peer connections. Remote audio is played by audio elements created by `RemoteAudioPlayer`.

The frontend also calculates audio level locally and broadcasts `audio-level` over signaling. Remote clients use this to show speaking indicators. This signal is a UI indicator only; it is not a replacement for the actual audio track. If speaking indicators move but no sound is heard, debug the WebRTC audio track and ICE path, not the audio-level signal.

## Screen Sharing

Screen sharing uses `navigator.mediaDevices.getDisplayMedia`.

Important behavior:

- It requires a secure context on production domains.
- It cannot be enabled on browsers that do not implement `getDisplayMedia`.
- Many mobile browsers do not support screen capture.
- The application should show a clear unsupported message when the browser lacks the API.
- Screen-share rendering should use non-cropping fit behavior. Empty side space is acceptable.

When screen sharing starts, the frontend should publish `media-state`, replace video senders with the display track, and handle the display track `ended` event.

## ICE And Reachability

ICE configuration depends on values provided to clients from backend/SFU configuration:

- `TURN_PUBLIC_IP`
- `TURN_PORT`
- `TURN_HOST_PORT`
- `TURN_RELAY_PORT_MIN`
- `TURN_RELAY_PORT_MAX`
- `TURN_SECRET`
- `WEBRTC_UDP_PORT_MIN`
- `WEBRTC_UDP_PORT_MAX`

For production servers:

- `TURN_PUBLIC_IP` must be reachable from the browser clients.
- Docker must publish `TURN_HOST_PORT` for TCP and UDP on the coturn service.
- Docker must publish `TURN_RELAY_PORT_MIN` through `TURN_RELAY_PORT_MAX` as UDP on the coturn service.
- Docker must publish `WEBRTC_UDP_HOST_PORT_MIN` through `WEBRTC_UDP_HOST_PORT_MAX` as UDP.
- The server firewall must allow those same ports.
- Caddy only handles HTTPS/WSS; it does not forward arbitrary WebRTC UDP media traffic.

For local Docker testing on the same machine, `TURN_PUBLIC_IP=127.0.0.1` is intentional. The backend SFU advertises that address in ICE candidates so the browser connects to Docker-published UDP ports instead of unreachable container bridge addresses.

## P2P And SFU Behavior

The UI should not expose implementation labels such as P2P or SFU to normal users. Internally:

- Peers start in `p2p` mode.
- The frontend reports stats with bitrate, packet loss, and RTT.
- The backend triggers `sfu-switch` if bitrate is below `SFU_FALLBACK_THRESHOLD_KBPS`, packet loss is too high, or RTT is too high.
- The backend can also switch a whole room when the participant count reaches `SFU_AUTO_PEER_THRESHOLD`.
- The frontend handles `sfu-switch`, `sfu-answer`, `sfu-ice-candidate`, and `sfu-renegotiate-needed`.
- P2P media is kept as a fallback during SFU setup. It must not be stopped only because a peer mode changed to SFU.
- SFU remote tracks are mapped to the owning peer through `sfu-renegotiate-needed`. If a track arrives before its owner mapping, the client stores it temporarily and publishes it when the owner mapping arrives.
- SFU peer connections should tolerate transient `disconnected` states. A disconnected state can recover; failed or closed states are terminal.

## Common Failure Modes

- Remote tile stays loading: signaling succeeded, but the expected remote track was not received or did not render.
- Remote tile stays loading after an SFU switch: P2P was cut over too early, SFU track owner mapping failed, or renegotiation did not complete.
- Black video: track exists but has no useful frames, wrong source was attached, browser autoplay/permission state changed, or sender replaced/stopped the track incorrectly.
- Audio indicator moves but no audio plays: `audio-level` signaling works, but the audio track is missing, muted, not attached, or blocked by autoplay/device routing.
- Works locally but fails on server: public IP, UDP port publishing, firewall, or reverse proxy configuration is wrong.
- Screen share unsupported on mobile: browser/OS limitation, not a server-side issue.
