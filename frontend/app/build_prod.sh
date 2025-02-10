export BUILD_ENV=production
export WEBAUTHN_ORIGIN=oc.app
export INTERNET_IDENTITY_CANISTER_ID=rdmx6-jaaaa-aaaaa-aaadq-cai
export INTERNET_IDENTITY_URL=https://identity.ic0.app
export NFID_URL=https://nfid.one/authenticate/?applicationName=OpenChat
export DFX_NETWORK=ic
export VIDEO_BRIDGE_URL=https://d7ufu5rwdb6eb.cloudfront.net
export IC_URL=https://icp-api.io
export II_DERIVATION_ORIGIN=https://6hsbt-vqaaa-aaaaf-aaafq-cai.ic0.app
export CUSTOM_DOMAINS=oc.app,webtest.oc.app
export BLOB_URL_PATTERN=https://{canisterId}.raw.icp0.io/{blobType}
export ACHIEVEMENT_URL_PATH=https://{canisterId}.raw.icp0.io
export WALLET_CONNECT_PROJECT_ID=adf8b4a7c5514a8229981aabdee2e246
export PREVIEW_PROXY_URL=https://dy7sqxe9if6te.cloudfront.net

npx rollup -c
