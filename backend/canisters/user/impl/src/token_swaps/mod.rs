use candid::Nat;
use ic_cdk::call::RejectCode;
use std::fmt::Debug;

pub mod icpswap;
pub mod kongswap;
pub mod sonic;
pub mod swap_client;

fn nat_to_u128(value: Nat) -> u128 {
    value.0.try_into().unwrap()
}

fn convert_error<E: Debug>(error: E) -> (RejectCode, String) {
    (RejectCode::SysUnknown, format!("{error:?}"))
}
