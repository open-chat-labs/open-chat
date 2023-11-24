use canister_client::{generate_candid_c2c_call_no_args, generate_candid_c2c_call_tuple_args};
use sonic_canister::*;

// Queries
generate_candid_c2c_call_tuple_args!(get_pair, getPair);

// Updates
generate_candid_c2c_call_tuple_args!(deposit);
generate_candid_c2c_call_no_args!(initiate_icrc1_transfer, initiateICRC1Transfer);
generate_candid_c2c_call_tuple_args!(swap_exact_tokens_for_tokens, swapExactTokensForTokens);
generate_candid_c2c_call_tuple_args!(withdraw);
