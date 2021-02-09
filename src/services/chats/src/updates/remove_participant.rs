use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use shared::user_id::UserId;
use crate::domain::chat::{ChatId, ChatEnum};
use crate::domain::chat_list::ChatList;
use self::Response::*;
use shared::timestamp;

pub fn update(chat_id: ChatId, user: UserId) -> Response {
    let chat_list: &mut ChatList = storage::get_mut();
    let me = shared::user_id::get_current();
    let now = timestamp::now();

    let chat = chat_list.get_mut(chat_id, &me);

    match chat {
        Some(ChatEnum::Group(group_chat)) => {
            if me == user {
                return CannotRemoveSelfFromChat;
            }

            match group_chat.remove_participant(&me, &user, now) {
                Some(true) => Success,
                Some(false) => ParticipantNotFound,
                None => Unauthorized
            }
        },
        Some(_) => NotGroupChat,
        None => ChatNotFound
    }
}

#[derive(CandidType)]
pub enum Response {
    Success,
    Unauthorized,
    ParticipantNotFound,
    CannotRemoveSelfFromChat,
    ChatNotFound,
    NotGroupChat
}