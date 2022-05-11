use candid::CandidType;
use serde::Deserialize;

pub type Args = transaction_notifier::add_token::Args;

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    AlreadyAdded,
    LedgerError(String),
    InternalError(String),
}
