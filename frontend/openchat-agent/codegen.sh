#!/usr/bin/env bash

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR

function generateTsAndJs {
  candidFile=$1
  outDir=$2

  didc bind $candidFile -t ts | sed -e 's/@dfinity/@icp-sdk\/core/g' > $outDir/types.d.ts
  didc bind $candidFile -t js > $outDir/idl.js
}

generateTsAndJs ../../backend/canisters/market_maker/api/can.did ./src/services/marketMaker/candid
generateTsAndJs ../../backend/canisters/storage_bucket/api/can.did ./src/services/storageBucket/candid
generateTsAndJs ../../backend/canisters/storage_index/api/can.did ./src/services/storageIndex/candid
generateTsAndJs ../../backend/canisters/translations/api/can.did ./src/services/translations/candid
generateTsAndJs ./src/services/bitcoin/candid/can.did ./src/services/bitcoin/candid
generateTsAndJs ./src/services/ckbtcMinter/candid/can.did ./src/services/ckbtcMinter/candid
generateTsAndJs ./src/services/dexes/icpSwap/index/candid/can.did ./src/services/dexes/icpSwap/index/candid
generateTsAndJs ./src/services/dexes/icpSwap/pool/candid/can.did ./src/services/dexes/icpSwap/pool/candid
generateTsAndJs ./src/services/dexes/kongswap/candid/can.did ./src/services/dexes/kongswap/candid
generateTsAndJs ./src/services/dexes/sonic/swaps/candid/can.did ./src/services/dexes/sonic/swaps/candid
generateTsAndJs ./src/services/icpcoins/candid/can.did ./src/services/icpcoins/candid
generateTsAndJs ./src/services/icpLedgerIndex/candid/can.did ./src/services/icpLedgerIndex/candid
generateTsAndJs ./src/services/ledger/candid/can.did ./src/services/ledger/candid
generateTsAndJs ./src/services/ledgerIndex/candid/can.did ./src/services/ledgerIndex/candid
generateTsAndJs ./src/services/nnsGovernance/candid/can.did ./src/services/nnsGovernance/candid
generateTsAndJs ./src/services/oneSecForwarder/candid/can.did ./src/services/oneSecForwarder/candid
generateTsAndJs ./src/services/oneSecMinter/candid/can.did ./src/services/oneSecMinter/candid
generateTsAndJs ./src/services/signInWithEmail/candid/can.did ./src/services/signInWithEmail/candid
generateTsAndJs ./src/services/signInWithEthereum/candid/can.did ./src/services/signInWithEthereum/candid
generateTsAndJs ./src/services/signInWithSolana/candid/can.did ./src/services/signInWithSolana/candid
generateTsAndJs ./src/services/snsGovernance/candid/can.did ./src/services/snsGovernance/candid
