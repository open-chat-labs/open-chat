use serde::{Deserialize, Serialize};
use types::{ChannelLatestMessageIndex, ChatId, Milliseconds, PublicCommunityActivity, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub community_name: String,
    pub channel: ChannelLatestMessageIndex,
    pub group_id: ChatId,
    pub group_name: String,
    pub members: Vec<UserId>,
    pub other_default_channels: Vec<ChannelLatestMessageIndex>,
    pub mark_active_duration: Milliseconds,
    pub public_community_activity: Option<PublicCommunityActivity>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
