use crate::TokenStandard;
use candid::{CandidType, Principal};
use human_readable::{HumanReadablePrincipal, ToHumanReadable};
use serde::{Deserialize, Serialize};
use types::{CanisterId, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub ledger_canister_id: CanisterId,
    pub payer: Option<UserId>,
    pub token_standard: TokenStandard,
    pub info_url: String,
    pub how_to_buy_url: String,
    pub transaction_url_format: String,
    pub logo: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    AlreadyAdded,
    InvalidRequest(String),
    PaymentFailed(String),
    InternalError(String),
}

#[derive(Serialize)]
pub struct HumanReadableArgs {
    ledger_canister_id: HumanReadablePrincipal,
    payer: Option<HumanReadablePrincipal>,
    token_standard: String,
    info_url: String,
    how_to_buy_url: String,
    transaction_url_format: String,
    logo: Option<String>,
}

impl ToHumanReadable for Args {
    type Target = HumanReadableArgs;

    fn to_human_readable(&self) -> Self::Target {
        HumanReadableArgs {
            ledger_canister_id: self.ledger_canister_id.into(),
            payer: self.payer.map(|user_id| Principal::from(user_id).into()),
            token_standard: self.token_standard.to_string(),
            info_url: self.info_url.clone(),
            how_to_buy_url: self.how_to_buy_url.clone(),
            transaction_url_format: self.transaction_url_format.clone(),
            logo: self.logo.clone(),
        }
    }
}
