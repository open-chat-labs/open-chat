use crate::env::Environment;
use candid::Principal;
use shared::types::chat_id::GroupChatId;

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

    fn group_chat_id(&self) -> GroupChatId {
        Principal::from_slice(&[1, 2, 3]).into()
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
