use candid::Deserialize;
use serde::Serialize;
use ts_export::ts_export;
use types::Empty;

pub type Args = Empty;

#[ts_export(user, update_btc_balance)]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum Response {
    Success,
    NoUpdates,
    Error(String),
}
