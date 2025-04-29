use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, OptionUpdate, UnitResult};

#[ts_export(community, update_webhook)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub id: Principal,
    pub name: Option<String>,
    #[ts(as = "types::OptionUpdateString")]
    pub avatar: OptionUpdate<String>,
}

pub type Response = UnitResult;
