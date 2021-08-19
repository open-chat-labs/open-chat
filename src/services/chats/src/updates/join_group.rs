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
    let chat = chat_list.get_unchecked_mut(chat_id);

    match chat {
        Some(ChatEnum::Group(group_chat)) => {
            let now = timestamp::now();
            if group_chat.is_user_in_group(&me) {
                AlreadyInGroup
            } else {
                let added = group_chat.add_participant(me, now);
                if added {
                    chat_list.link_chat_to_user(chat_id, me);
                    Success
                } else {
                    GroupSizeLimitReached
                }
            }
        }
        Some(_) => NotGroupChat,
        None => ChatNotFound,
    }
}

#[derive(CandidType)]
pub enum Response {
    Success,
    AlreadyInGroup,
    GroupSizeLimitReached,
    ChatNotFound,
    NotGroupChat,
}
