use canister_client::{generate_candid_c2c_call, generate_candid_c2c_call_no_args};
use one_sec_minter_canister::*;

// Queries
generate_candid_c2c_call!(get_forwarding_address);
generate_candid_c2c_call_no_args!(get_metadata);

// Updates
generate_candid_c2c_call!(transfer_icp_to_evm);
