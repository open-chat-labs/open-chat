for canister in ./backend/canisters/*/
do
  canister=${canister%*/}
  candid=${canister}/api/can.did
  echo validating ${candid}
  didc check ${candid} || exit 1
done
