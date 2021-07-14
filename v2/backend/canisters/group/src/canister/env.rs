use crate::env::Environment;
use candid::Principal;
use shared::time;
use shared::time::TimestampMillis;
use shared::types::chat_id::GroupChatId;

pub struct CanisterEnv {}

impl CanisterEnv {
    pub fn new() -> Self {
        CanisterEnv {}
    }
}

impl Environment for CanisterEnv {
    fn now(&self) -> TimestampMillis {
        time::now_millis()
    }

    fn caller(&self) -> Principal {
        ic_cdk::caller()
    }

    fn group_chat_id(&self) -> GroupChatId {
        ic_cdk::id().into()
    }
}
