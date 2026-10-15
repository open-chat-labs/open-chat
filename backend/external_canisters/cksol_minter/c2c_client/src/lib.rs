use canister_client::{generate_candid_c2c_call, generate_candid_c2c_call_with_payment};
use cksol_minter_canister::*;

// Queries

// Updates
generate_candid_c2c_call!(get_deposit_address);
generate_candid_c2c_call_with_payment!(deposit_sol);
