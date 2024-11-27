use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{AirdropConfig, ChannelId, CommunityId};

#[ts_export(registry, set_airdrop_config)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub enabled: Option<bool>,
    pub community_id: Option<CommunityId>,
    pub channel_id: Option<ChannelId>,
    pub community_name: Option<String>,
    pub channel_name: Option<String>,
}

#[ts_export(registry, set_airdrop_config)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    IncompleteConfig,
    NotAuthorized,
    InternalError(String),
}

impl TryFrom<Args> for AirdropConfig {
    type Error = ();

    fn try_from(value: Args) -> Result<Self, Self::Error> {
        match (value.community_id, value.channel_id, value.community_name, value.channel_name) {
            (Some(community_id), Some(channel_id), Some(community_name), Some(channel_name)) => Ok(AirdropConfig {
                community_id,
                channel_id,
                community_name,
                channel_name,
            }),
            _ => Err(()),
        }
    }
}
