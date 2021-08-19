use self::Response::*;
use crate::domain::chat::ChatEnum;
use crate::domain::chat_list::ChatList;
use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use shared::chat_id::ChatId;
use shared::timestamp;

pub fn update(chat_id: ChatId) -> Response {
    let chat_list: &mut ChatList = storage::get_mut();
    let me = shared::user_id::get_current();
    let chat = chat_list.get_mut(chat_id, &me);

    match chat {
        Some(ChatEnum::Group(group_chat)) => {
            let now = timestamp::now();
            if group_chat.is_admin(&me) && group_chat.get_admin_count() == 1 {
                return LastAdminCannotLeave;
            }
            match group_chat.leave(&me, now) {
                Some(true) => {
                    chat_list.unlink_chat_from_user(&chat_id, &me);
                    Success
                }
                Some(false) => ParticipantNotFound,
                None => LastAdminCannotLeave,
            }
        }
        Some(_) => NotGroupChat,
        None => ChatNotFound,
    }
}

#[derive(CandidType)]
pub enum Response {
    Success,
    ParticipantNotFound,
    LastAdminCannotLeave,
    ChatNotFound,
    NotGroupChat,
}
