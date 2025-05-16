use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use types::{ChannelId, ChatEventType, CommunityEventType, UnitResult, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub channel_id: ChannelId,
    pub community_events: HashSet<CommunityEventType>,
    pub chat_events: HashSet<ChatEventType>,
}

pub type Response = UnitResult;
