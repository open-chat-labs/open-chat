use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::Empty;

pub type Args = Empty;

#[derive(CandidType, Serialize, Deserialize)]
pub struct Response {
    pub lifecycle: Option<i32>,
    pub decentralization_sale_open_timestamp_seconds: Option<u64>,
}
