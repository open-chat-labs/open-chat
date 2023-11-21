#![allow(non_snake_case)]
use canister_client::generate_candid_c2c_call_tuple_args;
use modclub_canister::*;

// Queries
generate_candid_c2c_call_tuple_args!(getProviderRules);

// Updates
generate_candid_c2c_call_tuple_args!(addProviderAdmin);
generate_candid_c2c_call_tuple_args!(addRules);
generate_candid_c2c_call_tuple_args!(registerProvider);
generate_candid_c2c_call_tuple_args!(submitHtmlContent);
generate_candid_c2c_call_tuple_args!(subscribe);
