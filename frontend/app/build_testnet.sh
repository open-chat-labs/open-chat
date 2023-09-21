if [ -z "$DFX_NETWORK" ]
then
  echo 'DFX_NETWORK' not set
  exit 1
fi

export BUILD_ENV=testnet
export INTERNET_IDENTITY_URL=https://qhbym-qaaaa-aaaaa-aaafq-cai.$DFX_NETWORK.testnet.dfinity.network/
export NFID_URL=https://qhbym-qaaaa-aaaaa-aaafq-cai.$DFX_NETWORK.testnet.dfinity.network/
export CLIENT_CACHING=true
export IC_URL=https://$DFX_NETWORK.testnet.dfinity.network/
export BLOB_URL_PATTERN=https://{canisterId}.raw.$DFX_NETWORK.testnet.dfinity.network/{blobType}/
export FRAME_ANCESTORS=https://ht7v7-iaaaa-aaaak-qakga-cai,https://mdocx-gyaaa-aaaak-qcbsq-cai,https://calm-pasca-49d7be.netlify.app,http://localhost:5173,https://zexzi-jyaaa-aaaam-abj3q-cai.icp0.io,https://xw4dq-4yaaa-aaaam-abeuq-cai.ic0.app

npx rollup -c
