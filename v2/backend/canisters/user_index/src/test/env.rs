use crate::env::Environment;
use candid::Principal;

pub struct TestEnv {
    pub now: u64,
    pub caller: Principal,
    pub random_u32: u32,
}

impl Environment for TestEnv {
    fn now(&self) -> u64 {
        self.now
    }

    fn caller(&self) -> Principal {
        self.caller
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
            random_u32: 1,
        }
    }
}
