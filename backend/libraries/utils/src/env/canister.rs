use crate::env::Environment;
use candid::Principal;
use rand::SeedableRng;
use rand::rngs::StdRng;
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
    static CANISTER_ID: LazyCell<CanisterId> = LazyCell::new(ic_cdk::api::canister_self);
    static ROOT_KEY: LazyCell<Vec<u8>> = LazyCell::new(ic_cdk::api::root_key);
}

impl Environment for CanisterEnv {
    fn now_nanos(&self) -> TimestampNanos {
        canister_time::now_nanos()
    }

    fn caller(&self) -> Principal {
        ic_cdk::api::msg_caller()
    }

    fn canister_id(&self) -> CanisterId {
        CANISTER_ID.with(|c| **c)
    }

    fn cycles_balance(&self) -> Cycles {
        ic_cdk::api::canister_cycle_balance()
    }

    fn liquid_cycles_balance(&self) -> Cycles {
        ic_cdk::api::canister_liquid_cycle_balance()
    }

    fn rng(&mut self) -> &mut StdRng {
        &mut self.rng
    }

    fn arg_data_raw(&self) -> Vec<u8> {
        ic_cdk::api::msg_arg_data()
    }

    fn ic_root_key(&self) -> Vec<u8> {
        ROOT_KEY.with(|rk| rk.to_vec())
    }
}

impl Default for CanisterEnv {
    fn default() -> Self {
        let seed = CanisterEnv::new([0; 32]).entropy();
        CanisterEnv::new(seed)
    }
}
