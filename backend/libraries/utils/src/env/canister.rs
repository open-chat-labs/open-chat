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
        ic_cdk::api::canister_balance128()
    }

    fn rng(&mut self) -> &mut StdRng {
        &mut self.rng
    }

    fn arg_data_raw(&self) -> Vec<u8> {
        ic_cdk::api::call::arg_data_raw()
    }
}

impl Default for CanisterEnv {
    fn default() -> Self {
        let seed = CanisterEnv::new([0; 32]).entropy();
        CanisterEnv::new(seed)
    }
}
