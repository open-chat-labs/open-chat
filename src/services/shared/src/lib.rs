use ic_cdk::export::candid::Principal;

pub type CanisterId = Principal;

pub mod c2c;
pub mod chat_id;
pub mod memory;
pub mod storage;
pub mod timestamp;
pub mod user_id;
