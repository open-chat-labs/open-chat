use candid::CandidType;
use serde::Deserialize;
use types::TransactionWrapper;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub start_index: u32,
    pub ascending: bool,
    pub max_transactions: u8,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub transactions: Vec<TransactionWrapper>,
    pub latest_transaction_index: Option<u32>,
}
