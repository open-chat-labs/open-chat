for canister_path in ./backend/canisters/*/
do
  canister_path=${canister_path%*/}
  canister_name=${canister_path##*/}
  candid=${canister_path}/api/can.did

  echo validating ${candid}
  cargo run -p ${canister_name}_canister > temp.did
  didc check ${candid} temp.did || exit 1
  didc check temp.did ${candid} || exit 1
done

rm temp.did
