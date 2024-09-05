use candid::CandidType;
use ts_export::ts_export;
use types::CanisterId;

#[ts_export(registry, set_token_enabled)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub ledger_canister_id: CanisterId,
    pub enabled: bool,
}

#[ts_export(registry, set_token_enabled)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success,
    NotAuthorized,
    InternalError(String),
}
