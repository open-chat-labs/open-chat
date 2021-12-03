didc bind ../backend/canisters/user_index/api/can.did -t ts > ./src/services/userIndex/candid/types.ts
didc bind ../backend/canisters/user_index/api/can.did -t js > ./src/services/userIndex/candid/idl.js

didc bind ../backend/canisters/user/api/can.did -t ts > ./src/services/user/candid/types.ts
didc bind ../backend/canisters/user/api/can.did -t js > ./src/services/user/candid/idl.js

didc bind ../backend/canisters/group/api/can.did -t ts > ./src/services/group/candid/types.ts
didc bind ../backend/canisters/group/api/can.did -t js > ./src/services/group/candid/idl.js

didc bind ../backend/canisters/group_index/api/can.did -t ts > ./src/services/groupIndex/candid/types.ts
didc bind ../backend/canisters/group_index/api/can.did -t js > ./src/services/groupIndex/candid/idl.js

didc bind ../backend/canisters/notifications/api/can.did -t ts > ./src/services/notifications/candid/types.ts
didc bind ../backend/canisters/notifications/api/can.did -t js > ./src/services/notifications/candid/idl.js

didc bind ../backend/canisters/online_users_aggregator/api/can.did -t ts > ./src/services/online/candid/types.ts
didc bind ../backend/canisters/online_users_aggregator/api/can.did -t js > ./src/services/online/candid/idl.js

SEARCH='const Notification'
REPLACE='import { IDL } from "@dfinity\/candid"\n\nexport const Notification'
cargo run --bin notification_candid_gen > notification.did
didc bind notification.did -t js | sed "s/$SEARCH/$REPLACE/" > ./src/services/notifications/candid/notification.js
rm notification.did
