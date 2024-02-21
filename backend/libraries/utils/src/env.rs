use candid::Principal;
use rand::rngs::StdRng;
use rand::Rng;
use rand::SeedableRng;
use sha256::sha256;
use types::{CanisterId, Cycles, TimestampMillis, TimestampNanos};

pub mod canister;
pub mod test;

pub trait Environment {
    fn now_nanos(&self) -> TimestampNanos;
    fn caller(&self) -> Principal;
    fn canister_id(&self) -> CanisterId;
    fn cycles_balance(&self) -> Cycles;
    fn rng(&mut self) -> &mut StdRng;

    fn now(&self) -> TimestampMillis {
        self.now_nanos() / 1_000_000
    }

    fn new_rng(&mut self) -> StdRng {
        let mut seed = Vec::new();

        seed.extend(self.rng().gen::<[u8; 32]>());
        seed.extend(self.caller().as_slice());
        seed.extend(self.now().to_ne_bytes());

        StdRng::from_seed(sha256(&seed))
    }
}
