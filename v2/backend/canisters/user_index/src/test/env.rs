use crate::env::Environment;
use candid::Principal;

pub struct TestEnv {
    pub now: u64,
    pub caller: Principal,
    pub random_u32: u32,
    pub sms_service_principals: Vec<Principal>,
    pub user_canister_wasm: Vec<u8>,
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

    fn sms_service_principals(&self) -> Vec<Principal> {
        self.sms_service_principals.clone()
    }

    fn user_canister_wasm(&self) -> &Vec<u8> {
        &self.user_canister_wasm
    }
}

impl Default for TestEnv {
    fn default() -> Self {
        TestEnv {
            now: 10000,
            caller: Principal::from_slice(&[1]),
            random_u32: 1,
            sms_service_principals: Vec::new(),
            user_canister_wasm: Vec::new(),
        }
    }
}
