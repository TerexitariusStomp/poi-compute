#!/usr/bin/env bash
# Push poi-compute to Radicle under the dedicated poi-compute identity
# (~/.radicle-poi — passphraseless; the disk is LUKS-encrypted).
# Run after commits:  scripts/radicle-publish.sh
set -euo pipefail
cd "$(dirname "$0")/.."

export RAD_HOME=/home/terex/.radicle-poi

rad node start 2>/dev/null || true   # no-op if already running
git push rad main

echo
rad ls 2>/dev/null | grep poi-compute || true
echo "https://radicle.network/nodes/rosa.radicle.network/rad:z2yQjfF2eoGti9tyLfJxJU1NcdHn6"
