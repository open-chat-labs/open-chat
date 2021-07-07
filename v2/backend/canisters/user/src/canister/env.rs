use crate::env::Environment;
use candid::Principal;
use shared::time;
use shared::time::TimestampMillis;
use shared::types::UserId;

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

    fn owner_user_id(&self) -> UserId {
        ic_cdk::api::id().into()
    }
}
