WATCH=$1

# export INTERNET_IDENTITY_URL=http://localhost:8080?canisterId=qhbym-qaaaa-aaaaa-aaafq-cai
export INTERNET_IDENTITY_URL=http://127.0.0.1:8080?canisterId=qhbym-qaaaa-aaaaa-aaafq-cai
export NFID_URL=http://localhost:8080?canisterId=qhbym-qaaaa-aaaaa-aaafq-cai
export DFX_NETWORK=local
export DEV_PORT=5001
export BLOB_URL_PATTERN=http://{canisterId}.localhost:8080/{blobType}/

npx rollup -c $WATCH
