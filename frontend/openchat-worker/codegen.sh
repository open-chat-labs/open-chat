didc bind ../../backend/canisters/user_index/api/can.did -t ts > ./src/services/userIndex/candid/types.d.ts
didc bind ../../backend/canisters/user_index/api/can.did -t js > ./src/services/userIndex/candid/idl.js

didc bind ../../backend/canisters/user/api/can.did -t ts > ./src/services/user/candid/types.d.ts
didc bind ../../backend/canisters/user/api/can.did -t js > ./src/services/user/candid/idl.js

didc bind ../../backend/canisters/group/api/can.did -t ts > ./src/services/group/candid/types.d.ts
didc bind ../../backend/canisters/group/api/can.did -t js > ./src/services/group/candid/idl.js

didc bind ../../backend/canisters/group_index/api/can.did -t ts > ./src/services/groupIndex/candid/types.d.ts
didc bind ../../backend/canisters/group_index/api/can.did -t js > ./src/services/groupIndex/candid/idl.js

didc bind ../../backend/canisters/local_user_index/api/can.did -t ts > ./src/services/localUserIndex/candid/types.d.ts
didc bind ../../backend/canisters/local_user_index/api/can.did -t js > ./src/services/localUserIndex/candid/idl.js

didc bind ../../backend/canisters/market_maker/api/can.did -t ts > ./src/services/marketMaker/candid/types.d.ts
didc bind ../../backend/canisters/market_maker/api/can.did -t js > ./src/services/marketMaker/candid/idl.js

didc bind ../../backend/canisters/notifications_index/api/can.did -t ts > ./src/services/notifications/candid/types.d.ts
didc bind ../../backend/canisters/notifications_index/api/can.did -t js > ./src/services/notifications/candid/idl.js

didc bind ../../backend/canisters/online_users/api/can.did -t ts > ./src/services/online/candid/types.d.ts
didc bind ../../backend/canisters/online_users/api/can.did -t js > ./src/services/online/candid/idl.js

didc bind ../../backend/canisters/registry/api/can.did -t ts > ./src/services/registry/candid/types.d.ts
didc bind ../../backend/canisters/registry/api/can.did -t js > ./src/services/registry/candid/idl.js

didc bind ../../backend/canisters/storage_bucket/api/can.did -t ts > ./src/services/storageBucket/candid/types.d.ts
didc bind ../../backend/canisters/storage_bucket/api/can.did -t js > ./src/services/storageBucket/candid/idl.js

didc bind ../../backend/canisters/storage_index/api/can.did -t ts > ./src/services/storageIndex/candid/types.d.ts
didc bind ../../backend/canisters/storage_index/api/can.did -t js > ./src/services/storageIndex/candid/idl.js

didc bind ./src/services/ledger/candid/can.did -t ts > ./src/services/ledger/candid/types.d.ts
didc bind ./src/services/ledger/candid/can.did -t js > ./src/services/ledger/candid/idl.js

didc bind ./src/services/nnsGovernance/candid/can.did -t ts > ./src/services/nnsGovernance/candid/types.d.ts
didc bind ./src/services/nnsGovernance/candid/can.did -t js > ./src/services/nnsGovernance/candid/idl.js

didc bind ./src/services/snsGovernance/candid/can.did -t ts > ./src/services/snsGovernance/candid/types.d.ts
didc bind ./src/services/snsGovernance/candid/can.did -t js > ./src/services/snsGovernance/candid/idl.js

didc bind ../../backend/canisters/community/api/can.did -t ts > ./src/services/community/candid/types.d.ts
didc bind ../../backend/canisters/community/api/can.did -t js > ./src/services/community/candid/idl.js

SEARCH='const Notification'
REPLACE='import { IDL } from "@dfinity\/candid"\n\nexport const Notification'
cargo run --bin notification_candid_gen > notification.did
didc bind notification.did -t js | sed "s/$SEARCH/$REPLACE/" > ./src/services/notifications/candid/notification.js
rm notification.did
