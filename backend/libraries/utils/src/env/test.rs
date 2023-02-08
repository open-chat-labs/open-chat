use crate::env::Environment;
use candid::Principal;
use rand::rngs::StdRng;
use rand::SeedableRng;
use types::{CanisterId, Cycles, TimestampNanos};

pub struct TestEnv {
    pub now: u64,
    pub caller: Principal,
    pub canister_id: Principal,
    pub cycles_balance: Cycles,
    pub rng: StdRng,
}

impl Environment for TestEnv {
    fn now_nanos(&self) -> TimestampNanos {
        self.now * 1_000_000
    }

    fn caller(&self) -> Principal {
        self.caller
    }

    fn canister_id(&self) -> CanisterId {
        self.canister_id
    }

    fn cycles_balance(&self) -> Cycles {
        self.cycles_balance
    }

    fn rng(&mut self) -> &mut StdRng {
        &mut self.rng
    }
}

impl Default for TestEnv {
    fn default() -> Self {
        TestEnv {
            now: 10000,
            caller: Principal::from_slice(&[1]),
            canister_id: Principal::from_slice(&[1, 2, 3]),
            cycles_balance: 1_000_000_000_000,
            rng: StdRng::seed_from_u64(0),
        }
    }
}
