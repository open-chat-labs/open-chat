use crate::env::Environment;
use candid::Principal;
use types::{CanisterId, Cycles, TimestampNanos};

pub struct TestEnv {
    pub now: u64,
    pub caller: Principal,
    pub canister_id: Principal,
    pub random_u32: u32,
    pub random: f64,
    pub cycles_balance: Cycles,
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

    fn random_u32(&mut self) -> u32 {
        self.random_u32
    }

    fn random(&mut self) -> f64 {
        self.random
    }

    fn cycles_balance(&self) -> Cycles {
        self.cycles_balance
    }
}

impl Default for TestEnv {
    fn default() -> Self {
        TestEnv {
            now: 10000,
            caller: Principal::from_slice(&[1]),
            canister_id: Principal::from_slice(&[1, 2, 3]),
            random_u32: 1,
            random: 0.5,
            cycles_balance: 1_000_000_000_000,
        }
    }
}
