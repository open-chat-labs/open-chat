use candid::Principal;
use types::{CanisterId, Cycles, TimestampMillis, TimestampNanos};

pub mod canister;
pub mod test;

pub trait Environment {
    fn now_nanos(&self) -> TimestampNanos;
    fn caller(&self) -> Principal;
    fn canister_id(&self) -> CanisterId;
    fn random_u32(&mut self) -> u32;
    fn random(&mut self) -> f64;
    fn cycles_balance(&self) -> Cycles;

    fn now(&self) -> TimestampMillis {
        self.now_nanos() / 1_000_000
    }
}
