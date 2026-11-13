#!/usr/bin/env bash
# Build the self-host images from this checkout: raft-server, raft-web,
# raft-tools (tag: $TAG, default self-host).
#
#   SERVER_URL=https://api.example.com ./build.sh            # native platform
#   PLATFORM=linux/amd64 SERVER_URL=... ./build.sh           # for an x86 VPS
#
# The web image bakes SERVER_URL in, so rebuild it when the API address changes.
# The build context is the tracked + untracked-but-not-ignored files only (no
# node_modules or build output), copied to a temporary directory.
set -euo pipefail

: "${SERVER_URL:?set SERVER_URL (the public API URL, e.g. https://api.example.com)}"
TAG="${TAG:-self-host}"
PLATFORM_ARGS=()
if [[ -n "${PLATFORM:-}" ]]; then PLATFORM_ARGS=(--platform "$PLATFORM"); fi

repo="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
ctx="$(mktemp -d)"
trap 'rm -rf "$ctx"' EXIT
(cd "$repo" && git ls-files -z --cached --others --exclude-standard | tar --null -T - -cf -) | tar -xf - -C "$ctx"

sha="$(git -C "$repo" rev-parse HEAD)"
now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

docker build ${PLATFORM_ARGS[@]+"${PLATFORM_ARGS[@]}"} -f "$ctx/packages/server/Dockerfile" \
  --build-arg RAFT_RELEASE_SHA="$sha" --build-arg RAFT_BUILD_AT="$now" \
  -t "raft-server:$TAG" "$ctx"
docker build ${PLATFORM_ARGS[@]+"${PLATFORM_ARGS[@]}"} -f "$ctx/packages/web/Dockerfile" \
  --build-arg VITE_API_URL="$SERVER_URL" --build-arg VITE_DEPLOYMENT_ENV=production --build-arg VITE_COMMIT_SHA="$sha" --build-arg VITE_BUILD_AT="$now" \
  -t "raft-web:$TAG" "$ctx"
docker build ${PLATFORM_ARGS[@]+"${PLATFORM_ARGS[@]}"} -f "$ctx/deploy/self-host/tools.Dockerfile" \
  -t "raft-tools:$TAG" "$ctx"

echo "Built raft-server:$TAG raft-web:$TAG raft-tools:$TAG"
