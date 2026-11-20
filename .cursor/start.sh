#!/usr/bin/env bash
# Boot the Next.js dev server. Environment builds snapshot disk after install
# and never keep processes, so this runs on every agent boot.
set -eo pipefail

cd "$(dirname "$0")/.."

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
set +u
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
set -u

version="$(tr -d '[:space:]' < .nvmrc)"
node_bin="${NVM_DIR}/versions/node/v${version}/bin"
if [[ ! -x "${node_bin}/node" ]]; then
  echo "Node ${version} is not installed at ${node_bin}. Run install first." >&2
  exit 1
fi
export PATH="${node_bin}:${PATH}"
hash -r

if timeout 1 bash -c 'echo >/dev/tcp/127.0.0.1/3000' 2>/dev/null; then
  echo "Next.js dev server already listening on port 3000"
  exit 0
fi

exec npm run dev -- --hostname 0.0.0.0 --port 3000
