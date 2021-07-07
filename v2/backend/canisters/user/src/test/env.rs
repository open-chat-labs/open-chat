use crate::env::Environment;
use candid::Principal;
use shared::types::UserId;

pub struct TestEnv {
    pub now: u64,
    pub caller: Principal,
    pub owner_user_id: UserId,
}

impl Environment for TestEnv {
    fn now(&self) -> u64 {
        self.now
    }

    fn caller(&self) -> Principal {
        self.caller
    }

    fn owner_user_id(&self) -> UserId {
        self.owner_user_id
    }
}

impl Default for TestEnv {
    fn default() -> Self {
        TestEnv {
            now: 1,
            caller: Principal::from_slice(&[1]),
            owner_user_id: Principal::from_slice(&[1]).into(),
        }
    }
}
