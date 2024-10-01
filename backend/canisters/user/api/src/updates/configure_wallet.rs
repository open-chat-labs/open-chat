use crate::WalletConfig;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export(user, configure_wallet)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub config: WalletConfig,
}

#[ts_export(user, configure_wallet)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
