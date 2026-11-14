#!/usr/bin/env bash
# pnpm computer:install — build Raft Computer (with its daemon) from this
# checkout as a native binary and install it in place of the installed one,
# for self-hosted deployments that run unreleased changes.
#
#   pnpm computer:install              build, then install and restart
#   pnpm computer:install --build-only build into packages/computer/dist-native only
#   pnpm computer:install --no-build   install the binary already in dist-native
#   pnpm computer:install --rollback   put back the binary from before the last install
#
# Installing stops the running service, and every agent on this computer with
# it, then starts it again from the new binary. If the new binary fails to
# start, the previous one is restored and started. The previous binary is kept
# as bin/raft-computer.previous (one level of rollback).
#
# Do not use the web "upgrade" button or `raft-computer upgrade` afterwards:
# both install the official release over this build.
#
# RAFT_HOME picks the Computer home; without it (or if it has no installed
# bin/raft-computer), the single ~/.raft-computer-* (or ~/.raft) directory that
# has an installed raft-computer is used.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIST="$ROOT/packages/computer/dist-native"

die() { echo "computer:install: $*" >&2; exit 1; }
say() { echo "computer:install: $*"; }

mode=install
build=1
for arg in "$@"; do
  case "$arg" in
    --build-only) mode=build ;;
    --no-build) build=0 ;;
    --rollback) mode=rollback; build=0 ;;
    -h|--help) sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "unknown option: $arg (see --help)" ;;
  esac
done

case "$(uname -s)" in
  Darwin) platform=darwin ;;
  Linux) platform=linux ;;
  *) die "unsupported OS: $(uname -s)" ;;
esac
case "$(uname -m)" in
  arm64|aarch64) arch=arm64 ;;
  x86_64) arch=x64 ;;
  *) die "unsupported CPU: $(uname -m)" ;;
esac
BUILT="$DIST/raft-computer-$platform-$arch"

if [[ $build == 1 ]]; then
  cd "$ROOT"
  sha="$(git rev-parse HEAD)"
  git diff --quiet HEAD -- || say "note: the working tree has uncommitted changes; they are included in the build"
  say "building raft-computer ($platform-$arch) from $sha"
  # GITHUB_SHA is what the build bakes in as the build commit.
  GITHUB_SHA="$sha" pnpm --filter @botiverse/raft-computer build:native
  say "built $BUILT ($("$BUILT" --version))"
fi
[[ $mode == build ]] && exit 0

# A shell profile may export RAFT_HOME for an older Computer home with no
# installed binary (e.g. ~/.raft); fall back to auto-detection in that case.
if [[ -n "${RAFT_HOME:-}" && ! -x "$RAFT_HOME/bin/raft-computer" ]]; then
  say "RAFT_HOME=$RAFT_HOME has no bin/raft-computer; looking for an installed Computer instead"
  RAFT_HOME=""
fi
if [[ -z "${RAFT_HOME:-}" ]]; then
  candidates=()
  for dir in "$HOME"/.raft-computer-* "$HOME/.raft"; do
    [[ -x "$dir/bin/raft-computer" ]] && candidates+=("$dir")
  done
  case ${#candidates[@]} in
    0) die "no installed Raft Computer found under ~/.raft-computer-* or ~/.raft; set RAFT_HOME" ;;
    1) RAFT_HOME="${candidates[0]}" ;;
    *) die "several Raft Computer homes found; pick one with RAFT_HOME=<dir>: ${candidates[*]}" ;;
  esac
fi
export RAFT_HOME SLOCK_HOME="$RAFT_HOME"
BIN="$RAFT_HOME/bin"
TARGET="$BIN/raft-computer"
PREVIOUS="$BIN/raft-computer.previous"
[[ -x "$TARGET" ]] || die "$TARGET not found; set RAFT_HOME to a Computer home"
say "RAFT_HOME=$RAFT_HOME"

# Replace via rename so a running or cached copy is never written in place.
put() { # put <source binary> [<source wasm>]
  cp "$1" "$TARGET.new" && chmod +x "$TARGET.new" && mv -f "$TARGET.new" "$TARGET"
  if [[ -n "${2:-}" && -f "$2" ]]; then cp "$2" "$BIN/photon_rs_bg.wasm.new" && mv -f "$BIN/photon_rs_bg.wasm.new" "$BIN/photon_rs_bg.wasm"; fi
}

if [[ $mode == rollback ]]; then
  [[ -x "$PREVIOUS" ]] || die "no previous binary at $PREVIOUS"
  say "stopping the service (its agents stop too)"
  "$TARGET" stop || true
  put "$PREVIOUS" "$BIN/photon_rs_bg.wasm.previous"
  say "starting the restored binary ($("$TARGET" --version))"
  "$TARGET" start
  "$TARGET" status || true
  exit 0
fi

[[ -x "$BUILT" ]] || die "no built binary at $BUILT; run without --no-build"
"$BUILT" --version >/dev/null || die "$BUILT does not run"

say "keeping the current binary ($("$TARGET" --version)) as $PREVIOUS"
cp "$TARGET" "$PREVIOUS"
[[ -f "$BIN/photon_rs_bg.wasm" ]] && cp "$BIN/photon_rs_bg.wasm" "$BIN/photon_rs_bg.wasm.previous"

say "stopping the service (its agents stop too)"
"$TARGET" stop || true
put "$BUILT" "$DIST/photon_rs_bg.wasm"

say "starting the new binary"
if ! "$TARGET" start; then
  say "the new binary failed to start; restoring the previous one" >&2
  "$TARGET" stop || true
  put "$PREVIOUS" "$BIN/photon_rs_bg.wasm.previous"
  "$TARGET" start || die "the previous binary did not start either; check: $TARGET doctor"
  die "install failed and was rolled back"
fi
"$TARGET" status || true
say "installed. Roll back with: pnpm computer:install --rollback"
