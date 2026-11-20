#!/usr/bin/env bash
# Install the .nvmrc Node and project dependencies. Build snapshots do not
# keep processes, so this must only write files and then exit.
set -eo pipefail

cd "$(dirname "$0")/.."

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# nvm.sh reads unset variables.
set +u
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
nvm install
nvm alias default "$(tr -d '[:space:]' < .nvmrc)"
set -u

version="$(tr -d '[:space:]' < .nvmrc)"
node_bin="${NVM_DIR}/versions/node/v${version}/bin"
if [[ ! -x "${node_bin}/node" ]]; then
  echo "Node ${version} was not installed at ${node_bin}" >&2
  exit 1
fi

# nvm leaves another node ahead of its own on PATH in this image
# (/exec-daemon/node). npm's shebang is `#!/usr/bin/env node`, so prepend
# the versioned bin or npm ci runs on the wrong Node.
export PATH="${node_bin}:${PATH}"
hash -r

actual="$(node -v)"
if [[ "${actual}" != "v${version}" ]]; then
  echo "expected Node v${version}, got ${actual} ($(command -v node))" >&2
  exit 1
fi

npm ci
