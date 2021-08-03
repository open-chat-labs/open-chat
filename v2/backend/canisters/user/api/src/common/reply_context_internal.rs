use candid::CandidType;
use serde::Deserialize;
use shared::types::chat_id::GroupChatId;
use shared::types::EventIndex;

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct ReplyContextInternal {
    pub chat_id_if_other: Option<GroupChatId>,
    pub event_index: EventIndex,
}
