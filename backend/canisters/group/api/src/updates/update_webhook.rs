use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{OptionUpdate, UnitResult};

#[ts_export(group, update_webhook)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub id: Principal,
    pub name: Option<String>,
    #[ts(as = "types::OptionUpdateString")]
    pub avatar: OptionUpdate<String>,
}

pub type Response = UnitResult;
