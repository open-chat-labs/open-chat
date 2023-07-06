use canister_client::generate_candid_c2c_call;
use sns_wasm_canister::*;

// Queries
generate_candid_c2c_call!(list_deployed_snses);
