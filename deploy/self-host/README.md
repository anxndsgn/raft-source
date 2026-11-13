# Self-hosting Raft with Docker Compose

One machine runs everything: web (nginx), API server, Postgres, RisingWave,
Redis, and optionally Caddy for HTTPS. Agents run on separate machines
("Computers") that connect to the API server.

Community Edition limits apply (see `packages/server/src/edition.ts`): at most
5 human users per deployment, email/password sign-in only (no social login or
SSO), and the "Powered by Raft Community Edition" notice stays.

## Sizing

| Machine | Verdict |
| --- | --- |
| 4 GB RAM, 2 vCPU | Recommended minimum. The defaults are tuned for it. |
| 2 GB RAM | Not recommended: RisingWave alone has not been seen to run below a 2 GB budget. |

Default memory caps: RisingWave 2.5 GB (2 GB budget), server 1 GB, Postgres
384 MB, Redis 96 MB, web 32 MB. Measured idle use with one server: RisingWave
~870 MB, server ~580 MB, Postgres ~175 MB, Redis and web under 10 MB each,
about 1.6 GB in total. Add 2 GB of swap on the host as a safety margin.

## 1. Build the images

Build on your workstation, not on a 4 GB server (the web build alone needs a
few GB of memory). The web app has the API URL baked in.

```bash
cd deploy/self-host
PLATFORM=linux/amd64 SERVER_URL=https://api.example.com ./build.sh
docker save raft-server:self-host raft-web:self-host raft-tools:self-host | gzip > raft-images.tar.gz
scp raft-images.tar.gz docker-compose.yml risingwave.toml Caddyfile .env.example you@server:~/raft/
# on the server:
gunzip -c raft-images.tar.gz | docker load
```

## 2. Configure

```bash
cp .env.example .env
# fill in APP_URL, SERVER_URL, APP_HOST, API_HOST, JWT_SECRET, POSTGRES_PASSWORD
```

Point two DNS A records (e.g. `raft.example.com`, `api.example.com`) at the
server and open ports 80 and 443.

## 3. Start

```bash
docker compose --profile caddy up -d
docker compose logs -f migrate risingwave-bootstrap server
```

On every start, `migrate` brings the database schema up to date, then
`risingwave-bootstrap` creates RisingWave's CDC source and views (first start
only; later it checks they exist and exits), then `server` starts.

Without `--profile caddy`, web listens on `127.0.0.1:8080` and the API on
`127.0.0.1:3001`; put your own reverse proxy in front.

## 4. First account

Open `APP_URL` and sign up. Without `RESEND_API_KEY` no email is sent; the
verification link is printed to the server log instead:

```bash
docker compose logs server | grep -o 'http[^"]*?verify=[0-9a-f]*' | tail -1
```

Open that link in the browser you signed up in.

## 5. Connect a Computer (agent machine)

After creating a server, the web app shows a connect command for each machine
that should run agents. Because the images are built with your `SERVER_URL`,
the command already carries `--server-url https://api.example.com`, so the
Computer talks to your server rather than `api.raft.build`. (For a Computer
set up by hand: `--server-url`, or `RAFT_SERVER_URL` in its environment.)

## Options

- **Attachments**: stored in the `uploads` volume by default. For S3-compatible
  storage (Cloudflare R2, Tencent COS, AWS S3) fill in all `S3_*` variables.
- **External Postgres** (Neon, a cloud provider's Postgres): set `DATABASE_URL`
  and the `CDC_*` variables. It needs `wal_level=logical` (Neon: enable
  Logical Replication) and a database named `slock`; use a direct, not pooled,
  connection. The bundled `postgres` service still starts; stop it with
  `docker compose stop postgres` or delete it from the file.
- **Privacy mode** (`RAFT_PRIVACY_MODE`, on by default here) stops the server
  from contacting Raft's own services.

## Upgrades

Rebuild the images from the new revision, load them, then
`docker compose up -d`. `migrate` runs again before the server starts.

## Backups

Back up the `postgres` volume (or `pg_dump`) and `uploads`. RisingWave's state
is derived from Postgres: if its volume is lost, remove it and restart, and the
bootstrap rebuilds it. If a first bootstrap fails halfway, do the same:
`docker compose rm -sf risingwave && docker volume rm raft_risingwave`, then
`docker compose up -d` again (the bootstrap replaces its old replication slot).

## Push-to-deploy (GitHub Actions)

`.github/workflows/deploy-self-host.yml` runs on every push to `dev`: it builds
the three images on GitHub's x86 runners, pushes them to GHCR
(`ghcr.io/<owner>/raft-{server,web,tools}`, tagged with the commit and
`latest`), copies the compose files to the server, then pulls and restarts the
stack there and checks `SERVER_URL/health`.

One-time setup:

1. On the server: install Docker. Fill in a `.env` from `.env.example`, adding
   `RAFT_SERVER_IMAGE=ghcr.io/<owner>/raft-server:latest` (and the same for
   `RAFT_WEB_IMAGE`, `RAFT_TOOLS_IMAGE`) so a manual `docker compose up -d`
   uses the published images too. It goes into the `SELF_HOST_ENV` secret;
   every deploy writes it to `~/raft/.env` on the server.
2. Create a deploy key pair (`ssh-keygen -t ed25519 -N "" -f raft_deploy`) and
   append `raft_deploy.pub` to the server user's `~/.ssh/authorized_keys`.
3. Repository secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` (the
   private key), `SELF_HOST_ENV` (`gh secret set SELF_HOST_ENV < .env`). Repository variable: `SERVER_URL`; optionally `DEPLOY_PATH`.
4. After the first run, make the three GHCR packages public (package settings)
   if the server cannot pull them.
