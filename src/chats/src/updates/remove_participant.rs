use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use shared::user_id::UserId;
use crate::domain::chat::{ChatId, ChatEnum};
use crate::domain::chat_list::ChatList;

pub fn update(chat_id: ChatId, user: UserId) -> Result {
    let chat_list: &mut ChatList = storage::get_mut();
    let me = shared::user_id::get_current();

    let chat = chat_list.get_mut(chat_id, &me);

    match chat {
        Some(ChatEnum::Group(group_chat)) => {
            if me == user {
                return Result::CannotRemoveSelfFromChat;
            }

            match group_chat.remove_participant(&me, &user) {
                Some(true) => Result::Success,
                Some(false) => Result::ParticipantNotFound,
                None => Result::Unauthorized
            }
        },
        Some(_) => Result::NotGroupChat,
        None => Result::ChatNotFound
    }
}

#[derive(CandidType)]
pub enum Result {
    Success,
    Unauthorized,
    ParticipantNotFound,
    CannotRemoveSelfFromChat,
    ChatNotFound,
    NotGroupChat
}