#![allow(non_snake_case)]
use canister_client::{generate_candid_c2c_call, generate_candid_c2c_call_tuple_args};
use icdex_canister::*;

// Queries
generate_candid_c2c_call!(accountBalance);
generate_candid_c2c_call_tuple_args!(getTxAccount);
generate_candid_c2c_call_tuple_args!(level10);
generate_candid_c2c_call_tuple_args!(pending);
generate_candid_c2c_call_tuple_args!(stats);

// Updates
generate_candid_c2c_call_tuple_args!(accountConfig);
generate_candid_c2c_call_tuple_args!(cancelByTxid);
generate_candid_c2c_call_tuple_args!(deposit);
generate_candid_c2c_call_tuple_args!(trade);
