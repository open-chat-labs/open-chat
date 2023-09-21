WATCH=$1

export BUILD_ENV=development
export INTERNET_IDENTITY_URL=http://127.0.0.1:8080?canisterId=qhbym-qaaaa-aaaaa-aaafq-cai
export NFID_URL=http://localhost:8080?canisterId=qhbym-qaaaa-aaaaa-aaafq-cai
export DFX_NETWORK=local
export DEV_PORT=5001
export BLOB_URL_PATTERN=http://{canisterId}.localhost:8080/{blobType}/
export FRAME_ANCESTORS=https://ht7v7-iaaaa-aaaak-qakga-cai,https://mdocx-gyaaa-aaaak-qcbsq-cai,https://calm-pasca-49d7be.netlify.app,http://localhost:5173,https://zexzi-jyaaa-aaaam-abj3q-cai.icp0.io,https://xw4dq-4yaaa-aaaam-abeuq-cai.ic0.app

npx rollup -c $WATCH
