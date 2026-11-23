#!/usr/bin/env bash
# Publish this checkout's Raft Computer build (macOS, Apple silicon) to the
# self-host server, so other Macs can install it with one command:
#
#   curl -fsSL https://<APP_HOST>/computer/install.sh | sh
#
#   scripts/dev/computer-publish.sh                build, then publish
#   scripts/dev/computer-publish.sh --no-build     publish the build already in dist-native
#   scripts/dev/computer-publish.sh --from <dir>   publish another checkout's dist-native build, under
#                                                  that checkout's commit (implies --no-build)
#
# The deploy's Caddy serves <DEPLOY_PATH>/computer at https://<APP_HOST>/computer/
# (deploy/self-host/Caddyfile). Each build goes to computer/<sha>/; install.sh
# and `latest` are replaced last, so an install in progress never mixes builds.
#
# Settings (environment):
#   RAFT_DEPLOY_ENV   the deploy's .env, for APP_HOST and API_HOST (default ~/.raft-deploy/raft.env)
#   DEPLOY_SSH        ssh destination of the server (default raft-vps)
#   DEPLOY_PATH       compose directory on the server (default raft)
#   SERVER_SLUG       server to connect new Macs to (required, e.g. my-team)
#   HOME_NAME         new Macs install into ~/.raft-computer-<HOME_NAME> (default customized)
#   COMMAND_NAME      the installed command's name (default raft-computer-<HOME_NAME>)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIST="$ROOT/packages/computer/dist-native"
die() { echo "computer:publish: $*" >&2; exit 1; }
say() { echo "computer:publish: $*"; }

build=1
from=""
while [[ $# -gt 0 ]]; do
  arg="$1"; shift
  case "$arg" in
    --no-build) build=0 ;;
    --from) from="$(cd "${1:?--from needs a checkout}" && pwd)"; shift; build=0 ;;
    -h|--help) sed -n '2,24p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "unknown option: $arg (see --help)" ;;
  esac
done

: "${SERVER_SLUG:?set SERVER_SLUG to the server new Macs connect to}"
ENV_FILE="${RAFT_DEPLOY_ENV:-$HOME/.raft-deploy/raft.env}"
DEPLOY_SSH="${DEPLOY_SSH:-raft-vps}"
DEPLOY_PATH="${DEPLOY_PATH:-raft}"
HOME_NAME="${HOME_NAME:-customized}"
COMMAND_NAME="${COMMAND_NAME:-raft-computer-$HOME_NAME}"
[[ -f "$ENV_FILE" ]] || die "no deploy env at $ENV_FILE (set RAFT_DEPLOY_ENV)"
env_value() { sed -n "s/^$1=//p" "$ENV_FILE" | tail -1 | tr -d '"'"'"' \r'; }
APP_HOST="$(env_value APP_HOST)"; API_HOST="$(env_value API_HOST)"
[[ -n "$APP_HOST" && -n "$API_HOST" ]] || die "APP_HOST and API_HOST must be set in $ENV_FILE"
BASE_URL="https://$APP_HOST/computer"

BUILD_ROOT="${from:-$ROOT}"
DIST="$BUILD_ROOT/packages/computer/dist-native"
cd "$BUILD_ROOT"
sha="$(git rev-parse HEAD)"
version="${sha:0:12}"
if [[ $build == 1 ]]; then
  git diff --quiet HEAD -- || die "the working tree has uncommitted changes; commit them first (the build is published under the commit)"
  say "building raft-computer (darwin-arm64) from $sha"
  GITHUB_SHA="$sha" pnpm --filter @botiverse/raft-computer build:native
fi
files=(raft-computer-darwin-arm64.gz raft-computer-darwin-arm64.gz.sha256 photon_rs_bg.wasm photon_rs_bg.wasm.sha256)
for f in "${files[@]}"; do [[ -f "$DIST/$f" ]] || die "missing $DIST/$f; build first"; done
(cd "$DIST" && shasum -a 256 -c raft-computer-darwin-arm64.gz.sha256 photon_rs_bg.wasm.sha256 >/dev/null) || die "dist-native checksums do not match"

stage="$(mktemp -d)"; trap 'rm -rf "$stage"' EXIT
sed -e "s#__BASE_URL__#$BASE_URL#" -e "s#__SERVER_SLUG__#$SERVER_SLUG#" \
    -e "s#__SERVER_URL__#https://$API_HOST#" -e "s#__COMMAND_NAME__#$COMMAND_NAME#" -e "s#__HOME_NAME__#$HOME_NAME#" \
    "$ROOT/deploy/self-host/computer/install.sh" > "$stage/install.sh"
grep -q '__[A-Z_]*__' "$stage/install.sh" && die "install.sh still has a placeholder"
sh -n "$stage/install.sh" || die "install.sh does not parse"
echo "$version" > "$stage/latest"

# Large files go through the deploy's R2 bucket (APP_STORAGE_R2_*, in both
# this env file and the server's .env): uploads from here straight to the
# server are slow and get cut off, the server's download from R2 is fast.
r2_var() { env_value "APP_STORAGE_R2_$1"; }
R2_ENDPOINT="$(r2_var ENDPOINT)"; R2_BUCKET="$(r2_var BUCKET)"; R2_REGION="$(r2_var REGION)"
[[ -n "$R2_ENDPOINT" && -n "$R2_BUCKET" ]] || die "APP_STORAGE_R2_ENDPOINT and APP_STORAGE_R2_BUCKET must be set in $ENV_FILE"
key="computer-dist/$version"
r2() { # r2 <curl args...>: a signed request to the bucket, credentials from the env file
  curl -fsS --retry 2 -m 900 --aws-sigv4 "aws:amz:${R2_REGION:-auto}:s3" \
    --user "$(r2_var ACCESS_KEY_ID):$(r2_var SECRET_ACCESS_KEY)" "$@"
}
for f in raft-computer-darwin-arm64.gz photon_rs_bg.wasm; do
  say "uploading $f to R2 ($R2_BUCKET/$key)"
  r2 -o /dev/null -T "$DIST/$f" "${R2_ENDPOINT%/}/$R2_BUCKET/$key/$f" || die "R2 upload failed for $f"
done

remote="$DEPLOY_PATH/computer"
say "placing build $version on $DEPLOY_SSH:$remote/$version"
# One ssh session: the server downloads the large files from R2 with its own
# credentials, then writes the small ones carried inline in the script.
{
  printf 'set -euo pipefail\ndeploy=%q; version=%q; key=%q\n' "$DEPLOY_PATH" "$version" "$key"
  cat <<'REMOTE'
cd "$HOME/$deploy" 2>/dev/null || cd "$deploy"
set -a; . ./.env; set +a
dir="computer/$version"; mkdir -p "$dir"
for f in raft-computer-darwin-arm64.gz photon_rs_bg.wasm; do
  curl -fsS --retry 2 -m 900 --aws-sigv4 "aws:amz:${APP_STORAGE_R2_REGION:-auto}:s3" \
    --user "$APP_STORAGE_R2_ACCESS_KEY_ID:$APP_STORAGE_R2_SECRET_ACCESS_KEY" \
    -o "$dir/$f.part" "${APP_STORAGE_R2_ENDPOINT%/}/$APP_STORAGE_R2_BUCKET/$key/$f"
  mv -f "$dir/$f.part" "$dir/$f"
done
put() { printf '%s' "$2" | base64 -d > "$1"; }
REMOTE
  for f in raft-computer-darwin-arm64.gz.sha256 photon_rs_bg.wasm.sha256; do
    printf 'put "$dir/%s" %q\n' "$f" "$(base64 < "$DIST/$f" | tr -d '\n')"
  done
  printf 'put computer/install.sh.new %q\n' "$(base64 < "$stage/install.sh" | tr -d '\n')"
  printf 'put computer/latest.new %q\n' "$(base64 < "$stage/latest" | tr -d '\n')"
  cat <<'REMOTE'
(cd "$dir" && sha256sum -c raft-computer-darwin-arm64.gz.sha256 photon_rs_bg.wasm.sha256 >/dev/null) || { echo "checksum mismatch on the server" >&2; exit 1; }
chmod 644 "$dir"/* computer/install.sh.new computer/latest.new
mv -f computer/install.sh.new computer/install.sh
mv -f computer/latest.new computer/latest
REMOTE
} > "$stage/remote.sh"
ssh "$DEPLOY_SSH" bash -s < "$stage/remote.sh" || die "placing the build on the server failed"
say "published $version: curl -fsSL $BASE_URL/install.sh | sh"
