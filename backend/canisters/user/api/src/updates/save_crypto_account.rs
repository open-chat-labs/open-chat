use crate::NamedAccount;
use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

pub type Args = NamedAccount;

#[ts_export(user, save_crypto_account)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    Invalid,
    NameTaken,
    UserSuspended,
    Error(OCError),
}
