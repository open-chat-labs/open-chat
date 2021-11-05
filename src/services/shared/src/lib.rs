use ic_cdk::export::candid::Principal;

pub type CanisterId = Principal;

mod accept_cycles;

pub use accept_cycles::accept_cycles;
pub mod c2c;
pub mod chat_id;
pub mod memory;
pub mod storage;
pub mod timestamp;
pub mod user_id;
