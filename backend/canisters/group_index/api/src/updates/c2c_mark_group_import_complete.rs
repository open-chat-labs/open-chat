use serde::{Deserialize, Serialize};
use types::{CanisterId, ChannelLatestMessageIndex, ChatId, Milliseconds, PublicCommunityActivity, SuccessOnly, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub community_name: String,
    pub local_user_index_canister_id: CanisterId,
    pub channel: ChannelLatestMessageIndex,
    pub group_id: ChatId,
    pub group_name: String,
    pub members: Vec<UserId>,
    pub other_public_channels: Vec<ChannelLatestMessageIndex>,
    pub mark_active_duration: Milliseconds,
    pub public_community_activity: Option<PublicCommunityActivity>,
}

pub type Response = SuccessOnly;
