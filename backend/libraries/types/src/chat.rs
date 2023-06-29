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

#[derive(CandidType, Serialize, Deserialize, Debug, Eq, PartialEq, Hash, Clone, Copy)]
pub enum MultiUserChat {
    Group(ChatId),
    Channel(CommunityId, ChannelId),
}

impl MultiUserChat {
    pub fn group_id(&self) -> Option<ChatId> {
        if let MultiUserChat::Group(group_id) = self {
            Some(*group_id)
        } else {
            None
        }
    }
}

impl From<MultiUserChat> for Chat {
    fn from(value: MultiUserChat) -> Self {
        match value {
            MultiUserChat::Group(c) => Chat::Group(c),
            MultiUserChat::Channel(cm, ch) => Chat::Channel(cm, ch),
        }
    }
}
