use crate::WalletConfig;
use candid::CandidType;
use ts_export::ts_export;

#[ts_export(user, configure_wallet)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub config: WalletConfig,
}

#[ts_export(user, configure_wallet)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success,
}
