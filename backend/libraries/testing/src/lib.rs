use candid::Principal;
use types::CanisterId;

pub mod rng;

pub const NNS_INTERNET_IDENTITY_CANISTER_ID: CanisterId = Principal::from_slice(&[0, 0, 0, 0, 0, 0, 0, 10, 1, 1]);
