use crate::env::Environment;
use candid::Principal;
use rand::rngs::StdRng;
use rand::{RngCore, SeedableRng};
use shared::time;
use shared::time::TimestampMillis;

#[allow(dead_code)]
pub struct CanisterEnv {
    rng: StdRng,
    sms_service_principals: Vec<Principal>,
    user_canister_wasm: Vec<u8>,
}

impl CanisterEnv {
    pub fn new(sms_service_principals: Vec<Principal>, user_canister_wasm: Vec<u8>) -> Self {
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
            sms_service_principals,
            user_canister_wasm,
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

    fn sms_service_principals(&self) -> Vec<Principal> {
        Vec::new()
    }

    fn user_canister_wasm(&self) -> &Vec<u8> {
        &self.user_canister_wasm
    }
}
