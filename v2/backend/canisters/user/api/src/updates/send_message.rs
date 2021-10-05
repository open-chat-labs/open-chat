use candid::CandidType;
use serde::Deserialize;
use types::*;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub message_id: MessageId,
    pub recipient: UserId,
    pub sender_name: String,
    pub content: MessageContent,
    pub replies_to: Option<ReplyContextArgs>,
}

#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Deserialize, Debug)]
pub enum ReplyContextArgs {
    Direct(DirectReplyContextArgs),
    Private(ReplyContext),
}

#[derive(CandidType, Deserialize, Debug)]
pub struct DirectReplyContextArgs {
    pub message_id: MessageId,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    RecipientBlocked,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub chat_id: ChatId,
    pub event_index: EventIndex,
    pub message_index: MessageIndex,
    pub timestamp: TimestampMillis,
}
