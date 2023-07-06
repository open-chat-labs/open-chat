use candid::CandidType;
use human_readable::{HumanReadablePrincipal, ToHumanReadable};
use serde::{Deserialize, Serialize};
use types::CanisterId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub ledger_canister_id: CanisterId,
    pub info_url: Option<String>,
    pub how_to_buy_url: Option<String>,
    pub transaction_url_format: Option<String>,
    pub logo: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    TokenNotFound,
}

#[derive(Serialize)]
pub struct HumanReadableArgs {
    ledger_canister_id: HumanReadablePrincipal,
    info_url: Option<String>,
    how_to_buy_url: Option<String>,
    transaction_url_format: Option<String>,
    logo: Option<String>,
}

impl ToHumanReadable for Args {
    type Target = HumanReadableArgs;

    fn to_human_readable(&self) -> Self::Target {
        HumanReadableArgs {
            ledger_canister_id: self.ledger_canister_id.into(),
            info_url: self.info_url.clone(),
            how_to_buy_url: self.how_to_buy_url.clone(),
            transaction_url_format: self.transaction_url_format.clone(),
            logo: self.logo.clone(),
        }
    }
}
