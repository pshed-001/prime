# PRIME

Personal Finance and Productivity Platform — engineered by
**ITGEL (Infinite Technology Global Enterprise Limited)**, Ogun State, Nigeria.

Offline-first mobile app + Node API. Companion documents:
- [System Design v2.1.0](/docs/Prime_System_Design_v2.1.0.md)
- [Implementation Blueprint v1.0.0](/docs/Prime_Implementation_Blueprint_v1.0.0.md)

## Stack

| Layer | Technology |
| --- | --- |
| API | Node.js 24 LTS + Express 5 + Prisma 7 + PostgreSQL 17 |
| Mobile | React Native + Expo SDK 56, expo-sqlite, Zustand, Skia |
| Shared | `@prime/shared` — Zod schemas + constants (single source of truth) |
| Infra | Docker Compose (postgres, pgbouncer, pgadmin, api) |

## Monorepo layout

```
apps/api/        Express API, Prisma schema, services, routes, middleware, seed
apps/mobile/     Expo SDK 56 app — screens, stores, SQLite, sync engine
packages/shared/ Zod validators + constants shared by API and mobile
docker/          docker-compose.yml, pgbouncer, init.sql
```

## Getting started (development)

Requires Node.js 24, pnpm 11, Docker.

```bash
# 1. Install dependencies
pnpm install

# 2. Start the database stack (postgres :5432, pgbouncer :5433, pgadmin :5050, api :3000)
cp docker/.env.example docker/.env   # edit credentials to taste
docker compose -f docker/docker-compose.yml up -d --build

# 3. Configure API env
cp apps/api/.env.example apps/api/.env   # set DATABASE_URL to the PgBouncer string

# 4. Migrate + generate + seed
pnpm --filter api migrate
pnpm --filter api seed      # seeds dev@prime.itgel.com / test@prime.itgel.com

# 5. Run the API
pnpm dev:api                # GET http://localhost:3000/health

# 6. Run the mobile app
pnpm dev:mobile             # Expo Metro; use a dev client build (eas.json profiles)
```

## Seed users (development only)

| Email | Password | Base currency |
| --- | --- | --- |
| dev@prime.itgel.com | `DevPass@123!` | NGN |
| test@prime.itgel.com | `TestPass@123!` | USD |

## Mandatory rules

- UUIDv7 is generated at the **service layer** via `uuidv7()`. Never omit `id`.
- The Prisma `datasource` block has **no `url` field** — Prisma 7 reads `DATABASE_URL`.
- All monetary values are `Decimal`. No `Float` for money.
- Soft deletes always write a **Tombstone** in the same transaction.
- Financial mutations always write an **AuditLog** in the same transaction.
- See Blueprint §2 for the full ruleset and §11 for the security checklist.