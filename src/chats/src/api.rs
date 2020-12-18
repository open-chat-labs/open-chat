use ic_cdk_macros::*;
use ic_types::Principal;
use crate::domain::chat::Message;
use crate::handlers::*;

#[update]
fn send_message(recipient: Principal, text: String) {
    send_message::update(recipient, text)
}

#[query]
fn get_messages(from_user: Principal, from_index: usize) -> Vec<Message> {
    get_messages::query(from_user, from_index)
}