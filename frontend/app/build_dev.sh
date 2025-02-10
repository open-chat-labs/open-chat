WATCH=$1

export BUILD_ENV=development
export WEBAUTHN_ORIGIN=localhost
export INTERNET_IDENTITY_CANISTER_ID=qhbym-qaaaa-aaaaa-aaafq-cai
export INTERNET_IDENTITY_URL=http://127.0.0.1:8080?canisterId=qhbym-qaaaa-aaaaa-aaafq-cai
export NFID_URL=http://localhost:8080?canisterId=qhbym-qaaaa-aaaaa-aaafq-cai
export VIDEO_BRIDGE_URL=http://localhost:5050
export PREVIEW_PROXY_URL=https://dy7sqxe9if6te.cloudfront.net

export DFX_NETWORK=local
export DEV_PORT=5001
export BLOB_URL_PATTERN=http://{canisterId}.localhost:8080/{blobType}
export ACHIEVEMENT_URL_PATH=http://{canisterId}.localhost:8080
export WALLET_CONNECT_PROJECT_ID=b9aafebed2abfaf8341afd9428c947d5
export NODE_OPTIONS="--max-old-space-size=8192"

npx rollup -c $WATCH
