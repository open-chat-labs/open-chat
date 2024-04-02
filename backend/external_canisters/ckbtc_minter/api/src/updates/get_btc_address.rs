use candid::{CandidType, Principal};
use icrc_ledger_types::icrc1::account::Subaccount;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default)]
pub struct Args {
    pub owner: Option<Principal>,
    pub subaccount: Option<Subaccount>,
}

pub type Response = String;
