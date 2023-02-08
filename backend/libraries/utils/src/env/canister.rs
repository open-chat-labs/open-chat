use crate::env::Environment;
use crate::time;
use candid::Principal;
use rand::rngs::StdRng;
use rand::SeedableRng;
use types::{CanisterId, Cycles, TimestampNanos};

pub struct CanisterEnv {
    rng: StdRng,
}

impl CanisterEnv {
    pub fn new(seed: [u8; 32]) -> Self {
        Self {
            rng: StdRng::from_seed(seed),
        }
    }
}

impl Environment for CanisterEnv {
    fn now_nanos(&self) -> TimestampNanos {
        time::now_nanos()
    }

    fn caller(&self) -> Principal {
        ic_cdk::caller()
    }

    fn canister_id(&self) -> CanisterId {
        ic_cdk::id()
    }

    fn cycles_balance(&self) -> Cycles {
        ic_cdk::api::canister_balance().into()
    }

    fn rng(&mut self) -> &mut StdRng {
        &mut self.rng
    }
}

impl Default for CanisterEnv {
    fn default() -> Self {
        let mut seed = [0; 32];
        seed[..8].copy_from_slice(&time::now_nanos().to_ne_bytes());
        Self::new(seed)
    }
}
