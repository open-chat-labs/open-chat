use candid::Principal;
use rand::rngs::StdRng;
use rand::Rng;
use sha256::sha256;
use types::{CanisterId, Cycles, Hash, TimestampMillis, TimestampNanos};

pub mod canister;
pub mod test;

pub trait Environment {
    fn now_nanos(&self) -> TimestampNanos;
    fn caller(&self) -> Principal;
    fn canister_id(&self) -> CanisterId;
    fn cycles_balance(&self) -> Cycles;
    fn rng(&mut self) -> &mut StdRng;
    fn arg_data_raw(&self) -> Vec<u8>;

    fn now(&self) -> TimestampMillis {
        self.now_nanos() / 1_000_000
    }

    fn entropy(&mut self) -> Hash {
        let mut bytes = Vec::new();

        bytes.extend(self.rng().r#gen::<Hash>());
        bytes.extend(self.canister_id().as_slice());
        bytes.extend(self.caller().as_slice());
        bytes.extend(self.now_nanos().to_ne_bytes());
        bytes.extend(self.cycles_balance().to_ne_bytes());
        bytes.extend(&self.arg_data_raw());

        sha256(&bytes)
    }
}
