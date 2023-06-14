use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;

use crate::{ChannelId, ChatId, CommunityId};

#[derive(CandidType, Serialize, Deserialize, Debug, Eq, PartialEq, Hash, Clone, Copy)]
pub enum Chat {
    Direct(ChatId),
    Group(ChatId),
    Channel(CommunityId, ChannelId),
}
