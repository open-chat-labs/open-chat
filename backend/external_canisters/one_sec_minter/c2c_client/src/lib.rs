use canister_client::generate_candid_c2c_call;
use one_sec_minter_canister::*;

pub use one_sec_minter_canister::ONE_SEC_MINTER_CANISTER_ID;

// Queries
generate_candid_c2c_call!(get_forwarding_address);

// Updates
generate_candid_c2c_call!(transfer_icp_to_evm);
