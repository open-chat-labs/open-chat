use crate::env::Environment;
use candid::Principal;
use rand::rngs::StdRng;
use rand::SeedableRng;
use std::cell::LazyCell;
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

thread_local! {
    static CANISTER_ID: LazyCell<CanisterId> = LazyCell::new(|| ic_cdk::id());
}

impl Environment for CanisterEnv {
    fn now_nanos(&self) -> TimestampNanos {
        canister_time::now_nanos()
    }

    fn caller(&self) -> Principal {
        ic_cdk::caller()
    }

    fn canister_id(&self) -> CanisterId {
        CANISTER_ID.with(|c| **c)
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
