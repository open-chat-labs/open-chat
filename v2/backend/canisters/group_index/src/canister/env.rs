use crate::env::Environment;
use candid::Principal;
use shared::time;
use shared::time::TimestampMillis;

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
}
