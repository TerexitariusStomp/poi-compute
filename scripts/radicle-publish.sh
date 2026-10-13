#!/usr/bin/env bash
# Publish poi-compute as a new public Radicle repo.
# Reads your key passphrase without touching shell history or disk.
set -euo pipefail
cd "$(dirname "$0")"

read -rs -p "Radicle key passphrase: " RAD_PASSPHRASE
echo
export RAD_PASSPHRASE

rad node start
rad init \
  --name poi-compute \
  --description "Proof-of-Interest compute commons — coordinator, node SDKs, durable daemon, prover, extension, NAOMS hive bridge" \
  --default-branch main \
  --public \
  .

echo
echo "Repository ID:"
rad ls 2>/dev/null | grep poi-compute || rad inspect
unset RAD_PASSPHRASE
