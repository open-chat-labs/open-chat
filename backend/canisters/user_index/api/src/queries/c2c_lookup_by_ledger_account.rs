use candid::CandidType;
use ic_ledger_types::AccountIdentifier;
use serde::Deserialize;
use types::UserId;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub account_identifier: AccountIdentifier,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(UserId),
    UserNotFound,
}
