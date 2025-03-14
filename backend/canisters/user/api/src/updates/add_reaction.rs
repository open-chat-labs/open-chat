use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{MessageId, MessageIndex, PushEventResult, Reaction, UserId};

#[ts_export(user, add_reaction)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub reaction: Reaction,
    pub correlation_id: u64,
}

#[ts_export(user, add_reaction)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    SuccessV2(PushEventResult),
    NoChange,
    InvalidReaction,
    MessageNotFound,
    ChatNotFound,
    UserSuspended,
    Error(u16, Option<String>),
}
