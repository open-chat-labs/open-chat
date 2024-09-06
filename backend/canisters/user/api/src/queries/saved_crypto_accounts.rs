use crate::NamedAccount;
use candid::CandidType;
use ts_export::ts_export;
use types::Empty;

pub type Args = Empty;

#[ts_export(user, saved_crypto_accounts)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success(Vec<NamedAccount>),
}
