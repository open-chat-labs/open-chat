
# Non OC env variables
export NODE_OPTIONS="--max-old-space-size=8192"
export NODE_ENV=development

# OC specific env variables
export OC_ACHIEVEMENT_URL_PATH=http://{canisterId}.localhost:8080
export OC_BLOB_URL_PATTERN=http://{canisterId}.raw.localhost:8080/{blobType}
export OC_BUILD_ENV=$NODE_ENV
export OC_WEBAUTHN_ORIGIN=localhost
export OC_DEV_PORT=5001
export OC_DFX_NETWORK=local
export OC_INTERNET_IDENTITY_CANISTER_ID=qhbym-qaaaa-aaaaa-aaafq-cai
export OC_INTERNET_IDENTITY_URL=http://qhbym-qaaaa-aaaaa-aaafq-cai.localhost:8080
export OC_NFID_URL=http://qhbym-qaaaa-aaaaa-aaafq-cai.localhost:8080
export OC_NODE_ENV=$NODE_ENV
export OC_PREVIEW_PROXY_URL=https://dy7sqxe9if6te.cloudfront.net
export OC_VIDEO_BRIDGE_URL=http://localhost:5050
export OC_WALLET_CONNECT_PROJECT_ID=b9aafebed2abfaf8341afd9428c947d5
export OC_WEBSITE_VERSION=200.20.2

npx rollup -c
