use crate::env::Environment;
use crate::time;
use candid::Principal;
use rand::rngs::StdRng;
use rand::{RngCore, SeedableRng};
use types::{CanisterId, Cycles, TimestampMillis};

pub struct CanisterEnv {
    rng: StdRng,
}

impl CanisterEnv {
    pub fn new() -> Self {
        CanisterEnv {
            // Seed the PRNG with the current time.
            //
            // This is safe since all replicas are guaranteed to see the same result of
            // timestamp::now() and it isn't easily predictable from the outside.
            rng: {
                let now_millis = time::now_nanos();
                let mut seed = [0u8; 32];
                seed[..8].copy_from_slice(&now_millis.to_be_bytes());
                seed[8..16].copy_from_slice(&now_millis.to_be_bytes());
                seed[16..24].copy_from_slice(&now_millis.to_be_bytes());
                seed[24..32].copy_from_slice(&now_millis.to_be_bytes());
                StdRng::from_seed(seed)
            },
        }
    }
}

impl Environment for CanisterEnv {
    fn now(&self) -> TimestampMillis {
        time::now_millis()
    }

    fn caller(&self) -> Principal {
        ic_cdk::caller()
    }

    fn canister_id(&self) -> CanisterId {
        ic_cdk::id()
    }

    fn random_u32(&mut self) -> u32 {
        self.rng.next_u32()
    }

    fn cycles_balance(&self) -> Cycles {
        ic_cdk::api::canister_balance().into()
    }
}

impl Default for CanisterEnv {
    fn default() -> Self {
        Self::new()
    }
}
