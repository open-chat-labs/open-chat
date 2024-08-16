use crate::{CanisterId, ChannelId, ChatId, CommunityId};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;
use ts_rs::TS;

#[derive(CandidType, Serialize, Deserialize, Debug, Eq, PartialEq, Hash, Clone, Copy, TS)]
pub enum Chat {
    Direct(ChatId),
    Group(ChatId),
    Channel(CommunityId, ChannelId),
}

impl Chat {
    pub fn canister_id(&self) -> CanisterId {
        match *self {
            Chat::Direct(c) => c.into(),
            Chat::Group(g) => g.into(),
            Chat::Channel(c, _) => c.into(),
        }
    }

    pub fn chat_type(&self) -> &'static str {
        match self {
            Chat::Direct(_) => "direct",
            Chat::Group(_) => "group",
            Chat::Channel(..) => "channel",
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Debug, Eq, PartialEq, Hash, Clone, Copy, TS)]
pub enum MultiUserChat {
    Group(ChatId),
    Channel(CommunityId, ChannelId),
}

impl MultiUserChat {
    pub fn canister_id(&self) -> CanisterId {
        match *self {
            MultiUserChat::Group(g) => g.into(),
            MultiUserChat::Channel(c, _) => c.into(),
        }
    }

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

impl TryFrom<Chat> for MultiUserChat {
    type Error = ();

    fn try_from(value: Chat) -> Result<Self, Self::Error> {
        match value {
            Chat::Group(c) => Ok(MultiUserChat::Group(c)),
            Chat::Channel(cm, ch) => Ok(MultiUserChat::Channel(cm, ch)),
            Chat::Direct(_) => Err(()),
        }
    }
}
