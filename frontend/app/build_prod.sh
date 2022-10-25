export INTERNET_IDENTITY_URL=https://identity.ic0.app
export NFID_URL=https://nfid.one/authenticate/?applicationName=OpenChat
export DFX_NETWORK=ic
export DEV_PORT=5001
export CLIENT_CACHING=true
export IC_URL=https://ic0.app
export II_DERIVATION_ORIGIN=https://6hsbt-vqaaa-aaaaf-aaafq-cai.ic0.app
export II_ALTERNATIVE_ORIGINS=https://oc.app,https://webtest.oc.app,https://xp7uu-xyaaa-aaaaf-aoa6a-cai.ic0.app
export LEDGER_CANISTER_ICP=ryjl3-tyaaa-aaaaa-aaaba-cai
export LEDGER_CANISTER_BTC=ryjl3-tyaaa-aaaaa-aaaba-cai
export LEDGER_CANISTER_CHAT=ryjl3-tyaaa-aaaaa-aaaba-cai
export BLOB_URL_PATTERN=https://{canisterId}.raw.ic0.app/{blobType}/
export ENABLE_MULTI_CRYPTO=false

npx rollup -c
