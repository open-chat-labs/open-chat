WATCH=$1

export INTERNET_IDENTITY_URL=http://127.0.0.1:8080?canisterId=qaa6y-5yaaa-aaaaa-aaafa-cai
export NFID_URL=http://127.0.0.1:8080?canisterId=qaa6y-5yaaa-aaaaa-aaafa-cai

npx rollup -c $WATCH
