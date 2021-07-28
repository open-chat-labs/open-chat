use candid::{CandidType, Principal};
use serde::Deserialize;
use shared::time::TimestampMillis;

#[derive(CandidType, Deserialize)]
pub struct Args {}

#[derive(CandidType, Deserialize)]
pub struct Response {
    pub unconfirmed_user_count: u64,
    pub confirmed_user_count: u64,
    pub created_user_count: u64,
    pub active_user_count: u64,
    pub online_user_count: u64,
    pub cycles_transferred: u128,
    pub cycles_balance: u64,
    pub bytes_used: u64,
    pub timestamp: TimestampMillis,
    pub caller_id: Principal,
    pub wasm_memory_used: u64,
}
