use crate::account_linking_code::AccountLinkingCode;
use candid::{CandidType, Deserialize};
use serde::Serialize;
use ts_export::ts_export;
use types::SignedDelegation;

#[ts_export(identity, create_account_linking_code)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    #[serde(with = "serde_bytes")]
    pub public_key: Vec<u8>,
    pub delegation: SignedDelegation,
}

#[ts_export(identity, create_account_linking_code)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(AccountLinkingCode),
    UserNotFound,
    DelegationTooOld,
}
