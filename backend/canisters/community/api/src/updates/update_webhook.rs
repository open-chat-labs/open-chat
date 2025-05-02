use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, OptionUpdate, UnitResult, UserId};

#[ts_export(community, update_webhook)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub id: UserId,
    pub name: Option<String>,
    #[ts(as = "types::OptionUpdateString")]
    pub avatar: OptionUpdate<String>,
}

pub type Response = UnitResult;
