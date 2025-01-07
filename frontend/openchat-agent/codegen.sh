SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR

didc bind ../../backend/canisters/identity/api/can.did -t ts > ./src/services/identity/candid/types.d.ts
didc bind ../../backend/canisters/identity/api/can.did -t js > ./src/services/identity/candid/idl.js

didc bind ../../backend/canisters/market_maker/api/can.did -t ts > ./src/services/marketMaker/candid/types.d.ts
didc bind ../../backend/canisters/market_maker/api/can.did -t js > ./src/services/marketMaker/candid/idl.js

didc bind ../../backend/canisters/storage_bucket/api/can.did -t ts > ./src/services/storageBucket/candid/types.d.ts
didc bind ../../backend/canisters/storage_bucket/api/can.did -t js > ./src/services/storageBucket/candid/idl.js

didc bind ../../backend/canisters/storage_index/api/can.did -t ts > ./src/services/storageIndex/candid/types.d.ts
didc bind ../../backend/canisters/storage_index/api/can.did -t js > ./src/services/storageIndex/candid/idl.js

didc bind ../../backend/canisters/translations/api/can.did -t ts > ./src/services/translations/candid/types.d.ts
didc bind ../../backend/canisters/translations/api/can.did -t js > ./src/services/translations/candid/idl.js

didc bind ./src/services/dexes/icpSwap/index/candid/can.did -t ts > ./src/services/dexes/icpSwap/index/candid/types.d.ts
didc bind ./src/services/dexes/icpSwap/index/candid/can.did -t js > ./src/services/dexes/icpSwap/index/candid/idl.js

didc bind ./src/services/dexes/icpSwap/pool/candid/can.did -t ts > ./src/services/dexes/icpSwap/pool/candid/types.d.ts
didc bind ./src/services/dexes/icpSwap/pool/candid/can.did -t js > ./src/services/dexes/icpSwap/pool/candid/idl.js

didc bind ./src/services/dexes/kongswap/candid/can.did -t ts > ./src/services/dexes/kongswap/candid/types.d.ts
didc bind ./src/services/dexes/kongswap/candid/can.did -t js > ./src/services/dexes/kongswap/candid/idl.js

didc bind ./src/services/dexes/sonic/swaps/candid/can.did -t ts > ./src/services/dexes/sonic/swaps/candid/types.d.ts
didc bind ./src/services/dexes/sonic/swaps/candid/can.did -t js > ./src/services/dexes/sonic/swaps/candid/idl.js

didc bind ./src/services/icpcoins/candid/can.did -t ts > ./src/services/icpcoins/candid/types.d.ts
didc bind ./src/services/icpcoins/candid/can.did -t js > ./src/services/icpcoins/candid/idl.js

didc bind ./src/services/icpSwap/candid/can.did -t ts > ./src/services/icpSwap/candid/types.d.ts
didc bind ./src/services/icpSwap/candid/can.did -t js > ./src/services/icpSwap/candid/idl.js

didc bind ./src/services/icpLedgerIndex/candid/can.did -t ts > ./src/services/icpLedgerIndex/candid/types.d.ts
didc bind ./src/services/icpLedgerIndex/candid/can.did -t js > ./src/services/icpLedgerIndex/candid/idl.js

didc bind ./src/services/ledger/candid/can.did -t ts > ./src/services/ledger/candid/types.d.ts
didc bind ./src/services/ledger/candid/can.did -t js > ./src/services/ledger/candid/idl.js

didc bind ./src/services/ledgerIndex/candid/can.did -t ts > ./src/services/ledgerIndex/candid/types.d.ts
didc bind ./src/services/ledgerIndex/candid/can.did -t js > ./src/services/ledgerIndex/candid/idl.js

didc bind ./src/services/nnsGovernance/candid/can.did -t ts > ./src/services/nnsGovernance/candid/types.d.ts
didc bind ./src/services/nnsGovernance/candid/can.did -t js > ./src/services/nnsGovernance/candid/idl.js

didc bind ./src/services/signInWithEmail/candid/can.did -t ts > ./src/services/signInWithEmail/candid/types.d.ts
didc bind ./src/services/signInWithEmail/candid/can.did -t js > ./src/services/signInWithEmail/candid/idl.js

didc bind ./src/services/signInWithEthereum/candid/can.did -t ts > ./src/services/signInWithEthereum/candid/types.d.ts
didc bind ./src/services/signInWithEthereum/candid/can.did -t js > ./src/services/signInWithEthereum/candid/idl.js

didc bind ./src/services/signInWithSolana/candid/can.did -t ts > ./src/services/signInWithSolana/candid/types.d.ts
didc bind ./src/services/signInWithSolana/candid/can.did -t js > ./src/services/signInWithSolana/candid/idl.js

didc bind ./src/services/snsGovernance/candid/can.did -t ts > ./src/services/snsGovernance/candid/types.d.ts
didc bind ./src/services/snsGovernance/candid/can.did -t js > ./src/services/snsGovernance/candid/idl.js

SEARCH='const Notification'
REPLACE='import { IDL } from "@dfinity\/candid"\n\nexport const Notification'
cargo run --bin notification_candid_gen > notification.did
didc bind notification.did -t js | sed "s/$SEARCH/$REPLACE/" > ./src/services/notifications/candid/notification.js
rm notification.did
