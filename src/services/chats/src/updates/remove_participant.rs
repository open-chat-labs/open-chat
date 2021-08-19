use self::Response::*;
use crate::domain::chat::ChatEnum;
use crate::domain::chat_list::ChatList;
use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use shared::chat_id::ChatId;
use shared::timestamp;
use shared::user_id::UserId;

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
            if !group_chat.is_admin(&user) {
                return Unauthorized;
            }
            match group_chat.remove_participant(&user, now) {
                true => {
                    chat_list.unlink_chat_from_user(&chat_id, &user);
                    Success
                }
                false => ParticipantNotFound,
            }
        }
        Some(_) => NotGroupChat,
        None => ChatNotFound,
    }
}

#[derive(CandidType)]
pub enum Response {
    Success,
    Unauthorized,
    ParticipantNotFound,
    CannotRemoveSelfFromChat,
    ChatNotFound,
    NotGroupChat,
}
