use ic_types::Principal;
use crate::domain::direct_chat::{ChatId, ChatSummary, Message};

pub trait Chat {
    fn get_id(&self) -> ChatId;
    fn involves_user(&self, user: &Principal) -> bool;
    fn push_message(&mut self, sender: &Principal, text: String, timestamp: u64) -> u32;
    fn get_messages(&self, me: &Principal, from_id: u32) -> Vec<Message>;
    fn mark_read(&mut self, me: &Principal, up_to_id: u32) -> u32;
    fn to_summary(&self, me: &Principal) -> ChatSummary;
}