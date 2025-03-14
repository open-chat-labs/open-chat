use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export(user, retrieve_btc)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub amount: u64,
    pub address: String,
}

#[ts_export(user, retrieve_btc)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(u64), // The block index of the ckBTC burn transaction
    ApproveError(String),
    RetrieveBtcError(String),
    InternalError(String),
    Error(u16, Option<String>),
}
