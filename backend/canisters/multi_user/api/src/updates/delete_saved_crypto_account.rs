use candid::Deserialize;
use serde::Serialize;
use ts_export::ts_export;
use types::UnitResult;

#[ts_export(user, delete_saved_crypto_account)]
#[derive(Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct Args {
    pub name: String,
}

pub type Response = UnitResult;
