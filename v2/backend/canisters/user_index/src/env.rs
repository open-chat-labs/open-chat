use candid::Principal;
use shared::time::TimestampMillis;

pub trait Environment {
    fn now(&self) -> TimestampMillis;
    fn caller(&self) -> Principal;
    fn random_u32(&mut self) -> u32;
    fn sms_service_principals(&self) -> Vec<Principal>;
    fn user_canister_wasm(&self) -> &Vec<u8>;
}
