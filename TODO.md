# TODO Roadmap

## 0) Immediate Priorities
- [ ] Fix file upload and download end-to-end reliability (presigned URL validity, proxy path stability, and browser compatibility checks).
- [ ] Improve overall UI quality (cleaner spacing, compact controls, consistent mobile layout, and visual polish).

## 1) Reliability and Stability
- [ ] Add a room connection state machine (`idle`, `joining`, `connected`, `reconnecting`, `failed`) to remove edge-case UI races.
- [ ] Add robust retry/backoff policy for API calls and LiveKit reconnect flows.
- [ ] Add upload retry + cancel support (`AbortController`) with clear user-facing error states.
- [ ] Add heartbeat/health checks between frontend and backend for faster failure detection.

## 2) Observability and Operations
- [ ] Add OpenTelemetry tracing for backend HTTP routes and outbound S3/LiveKit calls.
- [ ] Add Prometheus metrics endpoint and Grafana dashboards (request latency, error rate, room joins, upload success/fail).
- [ ] Add centralized error tracking (Sentry) for frontend and backend.
- [ ] Propagate request/trace IDs from ingress to backend logs for full request correlation.

## 3) API and Type Safety
- [ ] Define OpenAPI spec for backend routes.
- [ ] Generate frontend API client/types from OpenAPI (`openapi-typescript` or `orval`).
- [ ] Introduce shared schema validation (Zod) for request/response payloads across FE/BE.
- [ ] Enforce stricter TypeScript settings (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).

## 4) Testing Strategy
- [ ] Add backend unit tests (services, utils, error mappers).
- [ ] Add backend integration tests for room creation/join and upload URL generation.
- [ ] Add frontend unit/component tests (chat, media controls, room layout states).
- [ ] Add Playwright E2E scenarios: create room, join, toggle media, screen-share, upload/download.

## 5) Performance
- [ ] Split large frontend bundle with route-level and feature-level dynamic imports.
- [ ] Add lazy loading for non-critical room panels (chat/history side flows).
- [ ] Optimize media tile rendering to avoid unnecessary rerenders on track events.
- [ ] Add cache strategy for frequently-read endpoints where applicable.

## 6) Security Hardening
- [ ] Move all secrets to secure env/secret management and rotate regularly.
- [ ] Tighten CORS, rate-limit policies, and payload limits per endpoint.
- [ ] Add file-type validation and optional malware scanning pipeline before download distribution.
- [ ] Add dependency and container vulnerability scanning in CI (`npm audit`, `trivy`).

## 7) CI/CD and Release Discipline
- [ ] Add CI pipeline: lint, type-check, test, build, docker build, security checks.
- [ ] Add staging environment and release promotion flow (staging -> production).
- [ ] Add migration and rollback playbooks for database and infra changes.
- [ ] Add semantic versioning + changelog automation for release traceability.

## 8) UX / Product Polish
- [ ] Add upload progress bars and richer success/failure toasts.
- [ ] Improve accessibility: keyboard navigation, focus states, ARIA labels in room controls.
- [ ] Add responsive breakpoints audit for room layouts in small-height mobile screens.
- [ ] Add user settings persistence (mic/cam defaults, compact layout preferences).
