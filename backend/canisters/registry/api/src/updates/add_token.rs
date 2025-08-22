use candid::{CandidType, Principal};
use human_readable::{HumanReadablePrincipal, ToHumanReadable};
use serde::{Deserialize, Serialize};
use types::{CanisterId, UnitResult, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub ledger_canister_id: CanisterId,
    pub payer: Option<UserId>,
    pub info_url: String,
    pub transaction_url_format: String,
}

pub type Response = UnitResult;

#[derive(Serialize)]
pub struct HumanReadableArgs {
    ledger_canister_id: HumanReadablePrincipal,
    payer: Option<HumanReadablePrincipal>,
    info_url: String,
    transaction_url_format: String,
}

impl ToHumanReadable for Args {
    type Target = HumanReadableArgs;

    fn to_human_readable(&self) -> Self::Target {
        HumanReadableArgs {
            ledger_canister_id: self.ledger_canister_id.into(),
            payer: self.payer.map(|user_id| Principal::from(user_id).into()),
            info_url: self.info_url.clone(),
            transaction_url_format: self.transaction_url_format.clone(),
        }
    }
}
