use candid::Principal;
use shared::time::TimestampMillis;
use shared::types::chat_id::GroupChatId;

pub trait Environment {
    fn now(&self) -> TimestampMillis;
    fn caller(&self) -> Principal;
    fn group_chat_id(&self) -> GroupChatId;
}
