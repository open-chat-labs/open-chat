use crate::NamedAccount;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::Empty;

pub type Args = Empty;

#[ts_export(user, saved_crypto_accounts)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Vec<NamedAccount>),
}
