# PRIME — Offline-First Personal Finance & Productivity Platform

**PRIME is a mobile application** (React Native / Expo) backed by a Node.js API
and PostgreSQL. It works **offline-first**: every mutation is written to an
on-device SQLite database and queued for sync, so it keeps working without a
connection.

Built by **ITGEL (Infinite Technology Global Enterprise Limited)**, Ogun State, Nigeria.

Companion documents (specification of record):
- [System Design v2.1.0](/docs/Prime_System_Design_v2.1.0.md)
- [Implementation Blueprint v1.0.0](/docs/Prime_Implementation_Blueprint_v1.0.0.md)

---

## Table of contents

1. [Architecture](#architecture)
2. [What you need (apps & tools)](#what-you-need-apps--tools)
3. [Repository layout](#repository-layout)
4. [1. Backend — database + API](#1-backend--database--api)
   - [Recommended: Docker Compose](#recommended-docker-compose)
   - [Alternative: local PostgreSQL 16](#alternative-local-postgresql-16)
   - [Migrations & seed](#migrations--seed)
   - [Run the API](#run-the-api)
   - [Environment variables](#api-environment-variables)
5. [2. Mobile app](#2-mobile-app)
   - [API URL / phone networking](#api-url--phone-networking)
   - [Run on a phone with Expo Go (quick start)](#expo-go-quick-start)
   - [Run on an emulator](#emulator)
   - [Run a development build (dev client)](#development-build-dev-client)
6. [3. Building the APK](#3-building-the-apk)
   - [Remote build with EAS (recommended)](#remote-build-with-eas-recommended)
   - [Local build with EAS](#local-build-with-eas)
   - [Build with Android Studio](#build-with-android-studio)
   - [Install the APK on a phone](#install-the-apk-on-a-phone)
7. [Seed users](#seed-users)
8. [Sync / RLS notes](#sync--rls-notes)
9. [Troubleshooting](#troubleshooting)
10. [Mandatory rules](#mandatory-rules)

---

## Architecture

```
        ┌──────────────────────────────┐
        │       Android phone          │
        │  Expo app (React Native)     │
        │  - SQLite (offline store)    │
        │  - sync_queue + tombstones   │
        │  - foreground/background sync│
        └──────────┬───────────────────┘
                   │ HTTPS (REST, JWT)
        ┌──────────▼───────────────────┐
        │  Node.js API (Express 5)     │   apps/api
        │  Prisma 7 (driver adapter)   │
        │  Row-Level Security (RLS)    │
        └──────────┬───────────────────┘
                   │
        ┌──────────▼───────────────────┐
        │  PgBouncer (transaction)     │   docker/pgbouncer
        └──────────┬───────────────────┘
        ┌──────────▼───────────────────┐
        │  PostgreSQL 16               │   docker/postgres
        └──────────────────────────────┘
```

Shared Zod schemas live in `packages/shared` and are imported by **both** the
API and the mobile app so validation is never duplicated.

---

## What you need (apps & tools)

### Backend
| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | **24 LTS+** | Prisma 7 and the API require it (Node 22 is too old). Recommended via [nvm](https://github.com/nvm-sh/nvm). |
| pnpm | 11.x | `corepack enable` or `npm i -g pnpm@11` |
| Docker Desktop | latest | Simplest way to run Postgres + PgBouncer (compose stack). Only if you skip the local-Postgres option. |
| PostgreSQL | 16 (or 17) | Only needed if you DON'T use Docker. |

> On Linux/macOS make sure `node` resolves to v24:
> `nvm install 24 && nvm use 24 && node -v   # v24.x.x`

### Mobile — running the app
| What | When | Notes |
| --- | --- | --- |
| [Expo Go](https://expo.dev/go) on your phone | Fastest way to run the app | Search "Expo Go" on Play Store. Background-sync tasks are limited in Expo Go — use a dev build/APK for the full experience. |
| [Android Studio](https://developer.android.com/studio) | Emulator and/or local APK builds | Also gives you the Android SDK + platform-tools (`adb`). |
| Physical Android phone | Everything | USB debugging for dev builds; sideloading for APKs. |

### Mobile — building the APK
| Method | Needs | Recommended for |
| --- | --- | --- |
| **EAS cloud build** | Free [Expo account](https://expo.dev) + EAS CLI | The default. No Android Studio needed. |
| **EAS local build** | EAS CLI + Java 17 + Android SDK | APK made on your machine. |
| **Android Studio / gradle** | Android Studio | Manual native build; good for custom gradle work. |

---

## Repository layout

```
prime/
├── apps/
│   ├── api/                 Express API — routes, services, Prisma schema + migrations, seed
│   │   ├── prisma/          schema.prisma, migrations/, seed.js
│   │   └── src/             routes/, services/, middleware/, lib/
│   └── mobile/              Expo SDK 56 app — screens, stores, SQLite, sync engine
│       ├── app/             expo-router screens (auth, tabs)
│       ├── components/      UI components
│       ├── lib/             database.js, sync.js, repo.js, queue.js, api.js, midnight.js, device.js
│       ├── store/           Zustand stores (auth, tasks, expenses, assets, settings, sync)
│       ├── utils/           uuid (v7), format/timezone helpers
│       └── eas.json         build profiles (development / preview / production)
├── packages/shared/         @prime/shared — Zod schemas + constants used by API and Mobile
├── docker/                  docker-compose.yml, pgbouncer config, Postgres init scripts
└── pnpm-workspace.yaml
```

---

## 1. Backend — database + API

All commands run from the **repo root**.

```bash
nvm use 24
pnpm install
```

### Recommended: Docker Compose

The stack: `postgres` (16, port 5432), `pgbouncer` (transaction mode, **host port 6432**), `pgadmin` (port 5050), and the `api` (port 3000).

```bash
cp docker/.env.example docker/.env      # edit credentials if you want
docker compose -f docker/docker-compose.yml up -d --build
```

On first boot, `docker/init.sql` + `docker/init.sh`:
- create extensions and the RLS helper functions,
- provision the **`prime_app`** role (login, **NOBYPASSRLS** — required for RLS to apply),
- grant DML on all future tables via `ALTER DEFAULT PRIVILEGES`.

`docker/make_userlist.sh` regenerates pgbouncer's `userlist.txt` from the same
credentials on every container start (SCRAM-SHA-256, required by PostgreSQL 16).

Health check:
```bash
curl http://localhost:3000/health   # {"success":true,"data":{"status":"ok"},...}
```

### Alternative: local PostgreSQL 16

If you prefer no Docker, provision a local Postgres 16 and mimic the sandbox:

```bash
# create database + roles (as a superuser)
psql -U postgres -h localhost -c "CREATE DATABASE prime_db;"
psql -U postgres -h localhost -d prime_db \
  -c "CREATE ROLE prime_app LOGIN PASSWORD 'prime_app_password' NOSUPERUSER NOBYPASSRLS;"
psql -U postgres -h localhost -d prime_db \
  -c "GRANT CONNECT ON DATABASE prime_db TO prime_app; GRANT USAGE ON SCHEMA public TO prime_app;"
psql -U postgres -h localhost -d prime_db \
  -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLES TO prime_app;"
```

### Migrations & seed

> **Important:** migrations and seeding must run as the **schema owner**
> (`prime_user`), NOT as `prime_app` — the app role cannot run DDL, and
> because RLS is FORCEd on user tables, any INSERT from `prime_app` without a
> session user id is rejected. The API itself connects as `prime_app`; only
> migrate/seed use the owner URL.

All commands in this section work from the **repo root**
(`pnpm --filter api …`). First make sure **something is listening** on the
port you will use:

```bash
# Docker path → pgbouncer on 6432 (run the compose stack first!):
docker compose -f docker/docker-compose.yml up -d --build
# verify:
psql "postgresql://prime_user:prime_password@localhost:6432/prime_db" -c 'select 1'

# No-Docker path → your own Postgres on 5432 (create the roles first, see below):
psql -U postgres -h localhost -c "CREATE ROLE prime_user LOGIN PASSWORD 'prime_password' SUPERUSER;"
psql -U postgres -h localhost -c "CREATE DATABASE prime_db OWNER prime_user;"
psql -U postgres -h localhost -d prime_db \
  -c "CREATE ROLE prime_app LOGIN PASSWORD 'prime_app_password' NOSUPERUSER NOBYPASSRLS;"
psql -U postgres -h localhost -d prime_db -c "GRANT USAGE ON SCHEMA public TO prime_app;"
psql -U postgres -h localhost -d prime_db \
  -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLES TO prime_app;"
# verify:
psql "postgresql://prime_user:prime_password@localhost:5432/prime_db" -c 'select 1'
```

> Substitute your own host/port/passwords — the snippets above are defaults.

Then migrate, generate, and seed **using the owner URL**:

```bash
# Docker path (host 6432):
DATABASE_URL="postgresql://prime_user:prime_password@localhost:6432/prime_db" pnpm --filter api prisma migrate deploy
DATABASE_URL="postgresql://prime_user:prime_password@localhost:6432/prime_db" pnpm --filter api prisma generate
DATABASE_URL="postgresql://prime_user:prime_password@localhost:6432/prime_db" NODE_ENV=development pnpm --filter api seed

# No-Docker path (host 5432):
DATABASE_URL="postgresql://prime_user:prime_password@localhost:5432/prime_db" pnpm --filter api prisma migrate deploy
DATABASE_URL="postgresql://prime_user:prime_password@localhost:5432/prime_db" NODE_ENV=development pnpm --filter api seed
```

`seed.js` loads `apps/api/.env` itself (guard + `DATABASE_URL`), but the
command-line `DATABASE_URL` overrides it — always point it at an owner-capable
role, never `prime_app` (RLS FORCE rejects inserts without a session user).

Then run the API normally: it uses the runtime `DATABASE_URL` in
`apps/api/.env` (the `prime_app` string).

### Run the API

```bash
# repo root
cp apps/api/.env.example apps/api/.env    # already pre-filled for Docker
pnpm dev:api                              # nodemon, reloads on change
# or production-style:
pnpm --filter api start
```

Verify: `curl http://localhost:3000/health`.

### API environment variables

Everything important lives in `apps/api/.env`:

| Variable | Purpose | Default |
| --- | --- | --- |
| `DATABASE_URL` | Runtime DB connection (app role `prime_app`, via PgBouncer) | `postgresql://prime_app:prime_app_password@localhost:6432/prime_db` |
| `ADMIN_DATABASE_URL` | Owner (`prime_user`) connection string, *documentation only* — override `DATABASE_URL` with it when running `prisma migrate deploy` (see Migrations) | `postgresql://prime_user:prime_password@localhost:6432/prime_db` |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Auth signing secrets (**change in prod**) | — |
| `JWT_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | Token lifetimes | `15m` / `7d` |
| `QWEN_API_URL` / `QWEN_API_KEY` | AI receipt scanning (HuggingFace) | — |
| `EXCHANGE_RATE_API_URL` / `EXCHANGE_RATE_API_KEY` | FX rates for base-currency conversion | `open.er-api.com` |
| `EMAIL_API_KEY` | Transactional e-mail (verify / reset) | — |
| `RATE_LIMIT_MAX` / `AI_RATE_LIMIT_PER_HOUR` / `MAX_AI_AMOUNT_NGN` | Throttling | 100 / 30 / 10,000,000 |
| `CORS_ORIGINS` | Allowed web origins | `http://localhost:8081` |

---

## 2. Mobile app

### API URL — phone networking

The app reads the API base from **`EXPO_PUBLIC_API_URL`** at build/start time
(sets the default `http://localhost:3000/api` when missing).

- **Mobile Expo Go or emulator:**
  - Android emulator reaches your machine via `http://10.0.2.2:3000/api`
  - A **physical phone** cannot use `localhost` — use your computer's LAN IP,
    e.g. `http://192.168.1.50:3000/api` (find it with `ipconfig`/`ifconfig`).
- In production the EXPO Go / preview APK points at the real API, e.g.
  `https://api.prime.itgel.com/api`.

Create the app's env file (optional — defaults suffice for emulator):

```bash
cp apps/mobile/.env.example apps/mobile/.env
# then edit EXPO_PUBLIC_API_URL to your machine's LAN IP
```

> After changing `EXPO_PUBLIC_API_URL`, restart the Metro bundler with a clean
> cache: `pnpm dev:mobile -- --clear`.

Both API (port 3000) and Metro (port 8081) must be reachable from the phone —
on a real device ensure the phone is on the **same Wi-Fi** as your machine and
your firewall allows inbound 3000/8081.

### Expo Go — quick start

```bash
pnpm dev:mobile                      # starts Expo Metro (default :8081)
```

1. Install **Expo Go** from the Play Store.
2. Scan the QR code shown in the terminal (same Wi-Fi).
3. Register / log in against the running API.

> Expo Go caveat: native background modules (`expo-background-fetch`,
> `expo-task-manager`) are **limited** in Expo Go. Anything that needs
> background sync or TaskManager should be tested in a dev build or APK.

### Emulator

Install [Android Studio](https://developer.android.com/developer), create an
AVD (device image), then:

```bash
pnpm dev:mobile                      # choose "a" on the prompt to launch the AVD
# or press 'a' inside the running Expo terminal
```

The app will auto-reach the API at `http://10.0.2.2:3000/api`.

### Development build (dev client)

A dev build bundles the native modules (background tasks, camera, etc.) and is
the most faithful way to test locally:

```bash
pnpm --filter mobile build:development   # = eas build --profile development
```

then open the produced project in a dev client on your phone/emulator
(`npx expo run:android` w/ the android/ folder is the local alternative after
running `npx expo prebuild`). The dev client debugs via the same Metro host.

---

## 3. Building the APK

The app's application id is `com.itgel.prime`. `eas.json` already contains three
profiles:

| Profile | `buildType` | Use for |
| --- | --- | --- |
| `development` | apk | dev client (native debugging) |
| `preview` | apk | testable APK for friends / QA — **no Play Store** |
| `production` | apk | release signing, Play Store upload (`autoIncrement: true`) |

### Remote build with EAS (recommended)

```bash
npm i -g eas-cli
eas login                                        # free account at expo.dev
eas build:configure                              # one-time: links to your EAS project
```

> The first `eas build:configure` assigns a real `projectId` and replaces the
> `prime-itgel` placeholder in `apps/mobile/app.json`.

```bash
cd apps/mobile
eas build --profile preview --platform android   # unsigned-ish testable APK
```

Expo does the compiling in the cloud; when it finishes you get a download URL
and a QR code you can scan straight from the phone.

### Local build with EAS

Prerequisites: **Java 17**, an **Android SDK**, Expo/EAS CLI.

```bash
cd apps/mobile
eas build --profile preview --platform android --local
```

The APK lands in the repo (typically `build-*/` or the artifact path EAS
prints). Note: `--local` needs the native android project; run
`npx expo prebuild --platform android` once if it asks.

### Build with Android Studio

Classic Gradle path (full control, no EAS account needed):

```bash
cd apps/mobile
npx expo prebuild --platform android     # generates android/ from app.json
cd android
./gradlew assembleRelease                # Linux/macOS
gradlew.bat assembleRelease              # Windows
```

`assembleRelease` produces
`apps/mobile/android/app/build/outputs/apk/release/app-release.apk`.

> The release variant signs with the debug key by default — configure a real
> keystore under `android/app/build.gradle` for store distribution.

### Install the APK on a phone

1. Plug the phone in via USB (or transfer the file), or:
   `adb install -r path/to/app.apk` from `platform-tools`.
2. On Android: **Settings → Security → Unknown apps → allow your file browser**
   (only needed when not installing via `adb`).
3. Open the app and register or log in. The APK must point at a reachable API
   (`EXPO_PUBLIC_API_URL` baked in when the preview/production build was made).

---

## Seed users

Seeded by `pnpm seed` (development only):

| Email | Password | Base currency |
| --- | --- | --- |
| dev@prime.itgel.com | `DevPass@123!` | NGN |
| test@prime.itgel.com | `TestPass@123!` | USD |

---

## Sync / RLS notes

- Every offline mutation writes the SQLite row **and** the `sync_queue` entry in
  one transaction (`lib/repo.js` + `lib/queue.js`).
- The API applies **FORCE Row-Level Security**: connections run as `prime_app`
  (NOBYPASSRLS) and every statement carries
  `SELECT set_config('app.current_user_id', ..., true)` in its transaction.
  Connect as any role with `BYPASSRLS` (e.g. `prime_user`) and isolation silently
  disappears — that is why the API uses `prime_app`.
- Deletes are soft deletes + a `tombstones` row in the same transaction; the
  sync endpoint replays them to connected clients (10.0: tombstones always win).
- Daily reports (00:01 for the previous day) are produced **on-device**
  (`lib/midnight.js`) — they need the device clock/timezone, not the server's.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `ERR_PRS_CLIENT_ENGINE_NOT_FOUND` / Prisma start crash | Prisma 7 needs a driver adapter — install `@prisma/adapter-pg` + `pg` (already in `apps/api/package.json`) and ensure `DATABASE_URL` is set. |
| API starts but every query returns 0 rows / 404s | RLS context missing or you are connected as the schema owner. Login via the app, and confirm `pg_roles.rolbypassrls = false` for `prime_app`. |
| Phone can't reach the API | Use the LAN IP, not `localhost`; same Wi-Fi; firewall open on 3000. Emulator uses `10.0.2.2`. |
| `eas build` errors | Run `eas build:configure` first; confirm you're logged in; `android/` must exist for `--local`. |
| Node version errors | `node -v` must be ≥ 24. Use `nvm use 24`. |
| Background sync not firing | Normal in Expo Go — test in a dev build/APK; check notifications permission. |
| `prisma migrate` fails with permission denied | You ran it as `prime_app`. Use an owner URL (`prime_user`) instead. |
| `P1001: Can't reach database server at localhost:6432` | Nothing is listening there — the docker stack isn't up, or you meant local Postgres on 5432 (no-Docker path). Run `docker compose up -d --build` first, or use your local port. |
| `P1000: authentication failed for 'prime_user'` | That role doesn't exist (or has a different password) on your Postgres. Create it (`CREATE ROLE prime_user LOGIN PASSWORD '…' SUPERUSER;`) or substitute your real credentials. |
| Seed aborts with "must only run in development" | `NODE_ENV` wasn't `development`. It's auto-loaded from `.env` by the fixed seed, or pass `NODE_ENV=development` explicitly. |
| Seed inserts rejected by RLS / rows vanish | Seed/DDL ran as `prime_app`. Re-run with the owner URL — RLS FORCE blocks unflagged `prime_app` inserts. |
| Expo Rate-Limit warning about IPv6 keygen | Harmless Express note; not functional. |

---

## Mandatory rules

- UUIDv7 is generated at the **service layer** via `uuidv7()`. Never omit `id`.
- The Prisma `datasource` block has **no `url` field** — Prisma 7 reads `DATABASE_URL`.
- All monetary values are `Decimal`. No `Float` for money.
- Soft deletes always write a **Tombstone** in the same transaction.
- Financial mutations always write an **AuditLog** in the same transaction.
- See Blueprint §2 for the full ruleset and §11 for the security checklist.