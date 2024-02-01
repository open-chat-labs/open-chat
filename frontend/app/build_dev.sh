WATCH=$1

export BUILD_ENV=development
export INTERNET_IDENTITY_URL=http://127.0.0.1:8080?canisterId=qhbym-qaaaa-aaaaa-aaafq-cai
export NFID_URL=http://localhost:8080?canisterId=qhbym-qaaaa-aaaaa-aaafq-cai
export VIDEO_BRIDGE_URL=http://localhost:5050
# export VIDEO_BRIDGE_URL=https://video-bridge.vercel.app

export DFX_NETWORK=local
export DEV_PORT=5001
export BLOB_URL_PATTERN=http://{canisterId}.localhost:8080/{blobType}/

npx rollup -c $WATCH
