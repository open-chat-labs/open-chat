
set -euxo pipefail
cd "$(dirname "$(realpath "$0")")"
npm ci


export INTERNET_IDENTITY_URL=https://qaa6y-5yaaa-aaaaa-aaafa-cai.small12.dfinity.network/
export DFX_NETWORK=small12
export DEV_PORT=5001
export CLIENT_CACHING=true
export OPEN_STORAGE_INDEX_CANISTER=qjdve-lqaaa-aaaaa-aaaeq-cai
export LEDGER_CANISTER_ICP=ryjl3-tyaaa-aaaaa-aaaba-cai
export LEDGER_CANISTER_BTC=ryjl3-tyaaa-aaaaa-aaaba-cai
export LEDGER_CANISTER_CHAT=ryjl3-tyaaa-aaaaa-aaaba-cai
export BLOB_URL_PATTERN=http://{canisterId}.localhost:8000/{blobType}/
export ENABLE_MULTI_CRYPTO=false

export NODE_ENV=development

npx rollup -c
