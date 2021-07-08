use crate::env::Environment;
use candid::Principal;
use rand::rngs::StdRng;
use rand::{RngCore, SeedableRng};
use shared::time;
use shared::time::TimestampMillis;

#[allow(dead_code)]
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

    fn random_u32(&mut self) -> u32 {
        self.rng.next_u32()
    }
}
