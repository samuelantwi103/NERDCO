# NERDCO — Deployment & Local Dev Guide

## 1. Local Development Setup

### Prerequisites
- Node.js 22+
- pnpm 9+
- Docker & Docker Compose (optional for local DBs)

### Setup Steps
1. **Install dependencies:**
   ```bash
   cd backend
   pnpm install
   ```
2. **Environment variables:**
   Copy `.env.example` to `.env` in all four service directories (`backend/auth-service`, `backend/incident-service`, `backend/tracking-service`, `backend/analytics-service`).
   Fill in credentials for Neon PostgreSQL, CloudAMQP, and generate RS256 PEM keys.
3. **Database Migration and Seeding:**
   ```bash
   pnpm migrate
   pnpm seed
   ```
4. **Run backend services:**
   You will need to start all 4 services. In separate terminals, run:
   ```bash
   pnpm auth
   pnpm incident
   pnpm tracking
   pnpm analytics
   ```
5. **Run the web client:**
   ```bash
   cd frontend/web
   pnpm install
   pnpm dev
   ```

## 2. Docker Compose Deployment

To run the entire backend stack via Docker Compose:
```bash
cd backend
docker-compose up --build -d
```
Note: Make sure `.env` files are populated before building.

### Docker Build Context Notes (Monorepo)
- Service Dockerfiles in `backend/*/Dockerfile` are configured to build from the repository root context.
- This is required because each service depends on the shared `backend/domain-types` workspace package.

For Docker Compose (from `backend/`):
- `context` is set to `../` and `dockerfile` is set to `backend/<service>/Dockerfile`.

For Render (or any per-service Docker deployment):
- Root/build context should be repository root.
- Dockerfile path should be one of:
   - `backend/auth-service/Dockerfile`
   - `backend/incident-service/Dockerfile`
   - `backend/tracking-service/Dockerfile`
   - `backend/analytics-service/Dockerfile`

## 3. Flutter Mobile App (APK Build)

To build the first responder Android application:
1. Ensure the Flutter SDK (3.x) is installed.
2. Run standard pub get:
   ```bash
   cd frontend/mobile
   flutter pub get
   ```
3. Build the APK:
   ```bash
   flutter build apk --release
   ```
4. Sideload the generated APK located at `build/app/outputs/flutter-apk/app-release.apk` to an Android device.

## 4. Environment Variables Reference

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `RABBITMQ_URL` | AMQP connection string |
| `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` | RS256 Base64-encoded keys |
| `SERVICE_INTERNAL_SECRET` | Secret for service-to-service auth |
