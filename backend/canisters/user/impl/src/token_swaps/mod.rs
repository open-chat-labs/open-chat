use candid::Nat;
use ic_cdk::call::RejectCode;
use std::fmt::Debug;
use types::{C2CError, CanisterId};

pub mod icpswap;
pub mod kongswap;
pub mod swap_client;

fn nat_to_u128(value: Nat) -> u128 {
    value.0.try_into().unwrap()
}

fn convert_error<E: Debug>(canister_id: CanisterId, method_name: &str, error: E) -> C2CError {
    C2CError::new(canister_id, method_name, RejectCode::SysUnknown, format!("{error:?}"))
}
