use serde::{Deserialize, Serialize};
use types::{TimestampMillis, TokenInfo};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub input_token: TokenInfo,
    pub input_amount: u128,
    pub output_token: TokenInfo,
    pub output_amount: u128,
    pub expires_at: TimestampMillis,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    InvalidOffer(String),
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub id: u32,
}
