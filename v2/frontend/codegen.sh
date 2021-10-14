rm ./src/services/userIndex/candid/types.ts
rm ./src/services/userIndex/candid/idl.js
didc bind ../backend/canisters/user_index/api/can.did -t ts >> ./src/services/userIndex/candid/types.ts
didc bind ../backend/canisters/user_index/api/can.did -t js >> ./src/services/userIndex/candid/idl.js

rm ./src/services/user/candid/types.ts
rm ./src/services/user/candid/idl.js
didc bind ../backend/canisters/user/api/can.did -t ts >> ./src/services/user/candid/types.ts
didc bind ../backend/canisters/user/api/can.did -t js >> ./src/services/user/candid/idl.js

rm ./src/services/group/candid/types.ts
rm ./src/services/group/candid/idl.js
didc bind ../backend/canisters/group/api/can.did -t ts >> ./src/services/group/candid/types.ts
didc bind ../backend/canisters/group/api/can.did -t js >> ./src/services/group/candid/idl.js

rm ./src/services/groupIndex/candid/types.ts
rm ./src/services/groupIndex/candid/idl.js
didc bind ../backend/canisters/group_index/api/can.did -t ts >> ./src/services/groupIndex/candid/types.ts
didc bind ../backend/canisters/group_index/api/can.did -t js >> ./src/services/groupIndex/candid/idl.js

rm ./src/services/notifications/candid/types.ts
rm ./src/services/notifications/candid/idl.js
didc bind ../backend/canisters/notifications/api/can.did -t ts >> ./src/services/notifications/candid/types.ts
didc bind ../backend/canisters/notifications/api/can.did -t js >> ./src/services/notifications/candid/idl.js