
# Non OC env variables
export NODE_OPTIONS="--max-old-space-size=8192"
export NODE_ENV=development

# OC specific env variables
export OC_ACCOUNT_LINKING_CODES_ENABLED=true
export OC_ALCHEMY_API_KEY=6pSBD1eOqwyGDI1xFfV-p
export OC_BITCOIN_MAINNET_ENABLED=false
export OC_BLOB_URL_PATTERN=http://{canisterId}.raw.localhost:8080/{blobType}
export OC_BUILD_ENV=$NODE_ENV
export OC_CANISTER_URL_PATH=http://{canisterId}.localhost:8080
export OC_DEV_PORT=5001
export OC_DFX_NETWORK=local
# Note: changed the port to 8082, we do expect there to be a reverse proxy
# for the local dfx setup, since from dfx v0.28.0-beta1 we get a CORS issue
# when querying the local deployment. Once that's fixed we'll revert to port
# 8080 again.
export OC_IC_URL=http://localhost:8082
export OC_INTERNET_IDENTITY_CANISTER_ID=qhbym-qaaaa-aaaaa-aaafq-cai
export OC_INTERNET_IDENTITY_URL=http://qhbym-qaaaa-aaaaa-aaafq-cai.localhost:8080
export OC_NFID_URL=http://qhbym-qaaaa-aaaaa-aaafq-cai.localhost:8080
export OC_NODE_ENV=$NODE_ENV
export OC_PREVIEW_PROXY_URL=https://dy7sqxe9if6te.cloudfront.net
export OC_VAPID_PUBLIC_KEY=BD8RU5tDBbFTDFybDoWhFzlL5+mYptojI6qqqqiit68KSt17+vt33jcqLTHKhAXdSzu6pXntfT9e4LccBv+iV3A=
export OC_VIDEO_BRIDGE_URL=http://localhost:5050
export OC_WALLET_CONNECT_PROJECT_ID=b9aafebed2abfaf8341afd9428c947d5
export OC_WEBAUTHN_ORIGIN=localhost
export OC_WEBSITE_VERSION=200.20.2
export OC_ONESEC_FORWARDER_CANISTER="this-is-a-fake-canister-id"
export OC_ONESEC_MINTER_CANISTER="this-is-a-fake-canister-id"

npx rollup -c
