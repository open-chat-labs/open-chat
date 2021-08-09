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