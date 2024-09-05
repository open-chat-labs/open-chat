use crate::NamedAccount;
use candid::CandidType;
use ts_export::ts_export;

pub type Args = NamedAccount;

#[ts_export(user, save_crypto_account)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success,
    Invalid,
    NameTaken,
    UserSuspended,
}
