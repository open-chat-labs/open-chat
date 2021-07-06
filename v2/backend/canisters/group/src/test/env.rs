use crate::env::Environment;
use candid::Principal;

pub struct TestEnv {
    pub now: u64,
    pub caller: Principal,
}

impl Environment for TestEnv {
    fn now(&self) -> u64 {
        self.now
    }

    fn caller(&self) -> Principal {
        self.caller
    }
}

impl Default for TestEnv {
    fn default() -> Self {
        TestEnv {
            now: 1,
            caller: Principal::from_slice(&[1]),
        }
    }
}
