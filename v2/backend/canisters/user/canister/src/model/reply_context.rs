use candid::CandidType;
use serde::Deserialize;
use shared::types::chat_id::GroupChatId;
use shared::types::message_content::MessageContent;
use shared::types::MessageIndex;

#[derive(CandidType, Deserialize, Clone)]
pub struct ReplyContextInternal {
    pub chat_id_if_other: Option<GroupChatId>,
    pub message_index: MessageIndex,
}

#[derive(CandidType)]
pub enum ReplyContext {
    Standard(StandardReplyContext),
    Private(PrivateReplyContext),
}

#[derive(CandidType)]
pub struct StandardReplyContext {
    pub message_index: MessageIndex,
    pub sent_by_me: bool,
    pub content: MessageContent,
}

#[derive(CandidType)]
pub struct PrivateReplyContext {
    pub chat_id: GroupChatId,
    pub message_index: MessageIndex,
}
