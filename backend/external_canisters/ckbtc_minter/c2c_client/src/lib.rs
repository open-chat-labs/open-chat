use canister_client::generate_candid_c2c_call;
use ckbtc_minter_canister::*;

pub use ckbtc_minter_canister::CKBTC_MINTER_CANISTER_ID;

// Queries

// Updates
generate_candid_c2c_call!(get_btc_address);
generate_candid_c2c_call!(retrieve_btc_with_approval);
generate_candid_c2c_call!(update_balance);
