use candid::{CandidType, Principal};
use icrc_ledger_types::icrc1::account::Account;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub swap_id: u32,
    pub principal: Option<Principal>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Account),
    SwapNotFound,
    PrincipalNotFound,
    Error(OCError),
}
