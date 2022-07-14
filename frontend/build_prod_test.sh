export INTERNET_IDENTITY_URL=https://identity.ic0.app
export DFX_NETWORK=ic_test
export DEV_PORT=5001
export CLIENT_CACHING=true
export IC_URL=https://ic0.app
export II_DERIVATION_ORIGIN=https://pfs7b-iqaaa-aaaaf-abs7q-cai.ic0.app
export II_ALTERNATIVE_ORIGIN=https://test.oc.app
export OPEN_STORAGE_INDEX_CANISTER=6jemw-paaaa-aaaaf-ab2ea-cai
export LEDGER_CANISTER_ICP=ryjl3-tyaaa-aaaaa-aaaba-cai
export LEDGER_CANISTER_BTC=ryjl3-tyaaa-aaaaa-aaaba-cai
export LEDGER_CANISTER_CHAT=ryjl3-tyaaa-aaaaa-aaaba-cai
export BLOB_URL_PATTERN=https://{canisterId}.raw.ic0.app/{blobType}/
export ENABLE_MULTI_CRYPTO=false

npm i
npm run typecheck
npm run validate
npm run lint
npm run test
npx rollup -c
