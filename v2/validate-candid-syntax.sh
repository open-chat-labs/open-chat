for canister_path in ./backend/canisters/*/
do
  canister_path=${canister_path%*/}
  candid=${canister_path}/api/can.did

  echo validating ${candid}
  didc check ${candid} || exit 1
done
