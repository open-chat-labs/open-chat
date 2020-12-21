use ic_cdk_macros::*;
use ic_types::Principal;
use crate::domain::chat::Message;
use crate::queries::*;
use crate::updates::*;
use crate::domain::chat_list::ChatId;

// #[query]
// fn list_chats() -> Vec<ChatSummary> {
// }

#[query]
fn get_messages(chat_id: ChatId, from_index: usize) -> Option<Vec<Message>> {
    get_messages::query(chat_id, from_index)
}

#[update]
fn create_chat(recipient: Principal) -> Option<ChatId> {
    create_chat::update(recipient)    
}

#[update]
fn send_message(chat_id: ChatId, text: String) -> bool {
    send_message::update(chat_id, text)
}

