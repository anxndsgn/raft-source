# Small image for the one-shot RisingWave bootstrap (risingwave-bootstrap in
# docker-compose.yml): the bootstrap script, the SQL it applies, and its two
# runtime packages. Pinned to the versions in pnpm-lock.yaml.
ARG NODE_VERSION=24.22.1
FROM node:${NODE_VERSION}-bookworm-slim
WORKDIR /app
RUN echo '{"type":"module","private":true}' > package.json \
  && npm install --no-audit --no-fund pg@8.20.0 @oxc-node/core@0.1.6
COPY scripts/dev/raftdev-risingwave-bootstrap.ts scripts/dev/
COPY packages/server/scripts/bootstrap-risingwave-local.ts packages/server/scripts/risingwave-bootstrap-barrier.ts packages/server/scripts/
COPY infra/risingwave/sql/ infra/risingwave/sql/
CMD ["node", "--import", "@oxc-node/core/register", "packages/server/scripts/bootstrap-risingwave-local.ts"]
