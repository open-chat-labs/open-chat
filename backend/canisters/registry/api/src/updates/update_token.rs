use candid::CandidType;
use human_readable::{HumanReadablePrincipal, ToHumanReadable};
use serde::{Deserialize, Serialize};
use types::CanisterId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub ledger_canister_id: CanisterId,
    pub name: Option<String>,
    pub symbol: Option<String>,
    pub info_url: Option<String>,
    pub transaction_url_format: Option<String>,
    pub logo: Option<String>,
    pub fee: Option<u128>,
}

impl Args {
    pub fn new(ledger_canister_id: CanisterId) -> Args {
        Args {
            ledger_canister_id,
            name: None,
            symbol: None,
            info_url: None,
            transaction_url_format: None,
            logo: None,
            fee: None,
        }
    }

    pub fn has_updates(&self) -> bool {
        self.name.is_some()
            || self.symbol.is_some()
            || self.info_url.is_some()
            || self.transaction_url_format.is_some()
            || self.logo.is_some()
            || self.fee.is_some()
    }
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    TokenNotFound,
}

#[derive(Serialize)]
pub struct HumanReadableArgs {
    ledger_canister_id: HumanReadablePrincipal,
    name: Option<String>,
    symbol: Option<String>,
    info_url: Option<String>,
    transaction_url_format: Option<String>,
    logo: Option<String>,
}

impl ToHumanReadable for Args {
    type Target = HumanReadableArgs;

    fn to_human_readable(&self) -> Self::Target {
        HumanReadableArgs {
            ledger_canister_id: self.ledger_canister_id.into(),
            name: self.name.clone(),
            symbol: self.symbol.clone(),
            info_url: self.info_url.clone(),
            transaction_url_format: self.transaction_url_format.clone(),
            logo: self.logo.clone(),
        }
    }
}
