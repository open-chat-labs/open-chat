use crate::{CanisterId, ChannelId, ChatId, CommunityId};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::{Debug, Display, Formatter};
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Eq, PartialEq, Hash, Clone, Copy)]
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
}

pub enum ChatType {
    Direct,
    Group,
    Channel,
}

impl From<&Chat> for ChatType {
    fn from(value: &Chat) -> Self {
        match value {
            Chat::Direct(_) => ChatType::Direct,
            Chat::Group(_) => ChatType::Group,
            Chat::Channel(_, _) => ChatType::Channel,
        }
    }
}

impl Display for ChatType {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        let str = match self {
            ChatType::Direct => "direct",
            ChatType::Group => "group",
            ChatType::Channel => "channel",
        };

        f.write_str(str)
    }
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Eq, PartialEq, Hash, Clone, Copy)]
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
        if let MultiUserChat::Group(group_id) = self { Some(*group_id) } else { None }
    }

    pub fn chat_url(&self) -> String {
        const OC_ROOT_URL: &str = "https://oc.app/";

        match self {
            MultiUserChat::Group(group_id) => format!("{OC_ROOT_URL}group/{group_id}"),
            MultiUserChat::Channel(community_id, channel_id) => {
                format!("{OC_ROOT_URL}community/{community_id}/channel/{channel_id}")
            }
        }
    }

    pub fn message_url(&self, message_index: MessageIndex) -> String {
        let chat_url = self.chat_url();
        format!("{chat_url}/{message_index}")
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
