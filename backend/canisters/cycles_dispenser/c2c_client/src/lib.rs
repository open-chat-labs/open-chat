use canister_client::generate_candid_c2c_call;
use cycles_dispenser_canister::*;

// Queries

// Updates
generate_candid_c2c_call!(add_canister);
generate_candid_c2c_call!(c2c_request_cycles);
