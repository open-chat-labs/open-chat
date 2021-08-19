use candid::Principal;
use types::{CanisterId, TimestampMillis};

pub mod canister;
pub mod test;

pub trait Environment {
    fn now(&self) -> TimestampMillis;
    fn caller(&self) -> Principal;
    fn canister_id(&self) -> CanisterId;
    fn random_u32(&mut self) -> u32;
    fn test_mode(&self) -> bool;
}
