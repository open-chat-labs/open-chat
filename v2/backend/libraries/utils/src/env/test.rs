use crate::env::Environment;
use candid::Principal;
use types::CanisterId;

pub struct TestEnv {
    pub now: u64,
    pub caller: Principal,
    pub canister_id: Principal,
    pub random_u32: u32,
}

impl Environment for TestEnv {
    fn now(&self) -> u64 {
        self.now
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

    fn test_mode(&self) -> bool {
        true
    }
}

impl Default for TestEnv {
    fn default() -> Self {
        TestEnv {
            now: 10000,
            caller: Principal::from_slice(&[1]),
            canister_id: Principal::from_slice(&[1, 2, 3]),
            random_u32: 1,
        }
    }
}
