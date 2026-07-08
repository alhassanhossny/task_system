# Deployment Guide

TASK Flow SaaS is deployed as a monorepo with a NestJS API, Next.js web app, PostgreSQL, and Redis. This guide documents a production-ready Docker deployment baseline and the operational checks needed before exposing the service publicly.

## Production Checklist

- Use the `v1.0.0-beta` tag or a reviewed release branch.
- Keep existing Prisma migrations immutable after release tagging.
- Set every required environment variable explicitly.
- Run `corepack pnpm db:generate`, `corepack pnpm typecheck`, `corepack pnpm lint`, and the regression suite in CI before deployment.
- Run `prisma migrate deploy` before starting the API against a production database.
- Configure HTTPS at the reverse proxy or load balancer.
- Configure database and uploaded-file backups before onboarding tenants.

## Required Services

- Node.js 22 for local builds and CI.
- PostgreSQL 16.
- Redis 7 for BullMQ queues.
- Docker and Docker Compose for the included container deployment.

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Prisma PostgreSQL connection string used by the API. |
| `POSTGRES_DB` | Docker | PostgreSQL database name for Compose-managed local deployments. |
| `POSTGRES_USER` | Docker | PostgreSQL user for Compose-managed local deployments. |
| `POSTGRES_PASSWORD` | Docker | PostgreSQL password for Compose-managed local deployments. |
| `POSTGRES_PORT` | Docker | Host port mapped to container port `5432`. |
| `JWT_SECRET` | Yes | Long random signing secret for access and refresh tokens. |
| `JWT_EXPIRES_IN` | No | Access-token TTL, for example `15m`. |
| `JWT_REFRESH_EXPIRES_IN` | No | Refresh-token TTL, for example `7d`. |
| `SMTP_ENCRYPTION_KEY` | Yes | Long random key used to encrypt stored SMTP credentials. |
| `STORAGE_PUBLIC_BASE_URL` | No | Public base URL used for generated attachment metadata links. |
| `NEXT_PUBLIC_API_URL` | Yes | Public API origin used by the web app. |
| `WEB_ORIGIN` | Yes | Comma-separated CORS allow-list for browser clients. |
| `WEB_PORT` | Docker | Host port mapped to the web container. |
| `API_PORT` | Docker | Host port mapped to the API container. |
| `REDIS_HOST` | Yes | Redis host used by the API. |
| `REDIS_PORT` | Yes | Redis port used by the API. |
| `REDIS_DB` | No | Redis logical database number. |

Production secrets must not use the placeholder values from `.env.example`.

## Docker Deployment

Create a production `.env` file on the target machine:

```bash
cp .env.example .env
```

Update the secrets and public URLs, then build and start the stack:

```bash
docker compose build
docker compose up -d postgres redis
docker compose run --rm api pnpm --dir apps/api prisma migrate deploy
docker compose up -d api web
docker compose ps
```

Health checks:

```bash
curl -fsS http://127.0.0.1:${API_PORT:-4000}/api/v1/health
curl -fsSI http://127.0.0.1:${WEB_PORT:-3000}/ar/login
```

The Compose stack declares health checks for PostgreSQL, Redis, API, and web. The web service waits for the API health check before starting.

## Reverse Proxy Example

Example Nginx server blocks:

```nginx
server {
  listen 80;
  server_name app.example.com;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  server_name app.example.com;

  ssl_certificate /etc/letsencrypt/live/app.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/app.example.com/privkey.pem;

  location /api/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }

  location /docs {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
  }

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

Set:

```bash
NEXT_PUBLIC_API_URL=https://app.example.com
WEB_ORIGIN=https://app.example.com
```

## HTTPS Notes

- Terminate TLS at the reverse proxy or cloud load balancer.
- Redirect HTTP to HTTPS.
- Use secure, long random values for `JWT_SECRET` and `SMTP_ENCRYPTION_KEY`.
- Keep Swagger access behind trusted networks or authenticated infrastructure controls for production environments.

## Backups

Minimum backup baseline:

- PostgreSQL daily full backup.
- PostgreSQL point-in-time recovery if available.
- Redis persistence if queued jobs must survive node loss.
- Attachment object storage backup once binary storage is enabled.
- Offsite encrypted backup retention matching the company compliance policy.

Example database backup:

```bash
docker compose exec postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > taskflow-$(date +%F).sql
```

## Rolling Updates

1. Build the new API and web images.
2. Run `prisma migrate deploy`.
3. Start the new API container.
4. Confirm `/api/v1/health`.
5. Start the new web container.
6. Confirm `/ar/login`.
7. Monitor logs and queue processing.

Avoid editing historical Prisma migrations during rolling updates. Add a new migration only when a reviewed feature requires a database change.

## Operational Follow-Up

- Add production observability in Phase 5 Step 2:
  - readiness and liveness checks
  - structured request logging
  - request correlation IDs
  - Redis and PostgreSQL health details
- Add rate limiting for authentication and email-sending endpoints.
- Add real object storage for attachments before broad production usage.
