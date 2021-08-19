use self::Response::*;
use crate::domain::chat::ChatEnum;
use crate::domain::chat_list::ChatList;
use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use shared::chat_id::ChatId;

pub fn update(chat_id: ChatId) -> Response {
    let chat_list: &mut ChatList = storage::get_mut();
    let me = shared::user_id::get_current();
    let chat = chat_list.get_mut(chat_id, &me);
    match chat {
        Some(ChatEnum::Group(group_chat)) => {
            if !group_chat.is_admin(&me) {
                return Unauthorized;
            }
            if group_chat.get_admin_count() == 1 {
                return OnlyLastAdminCanDelete;
            }
            chat_list.delete_chat(chat_id);
            Success
        }
        Some(_) => NotGroupChat,
        None => ChatNotFound,
    }
}

#[derive(CandidType)]
pub enum Response {
    Success,
    Unauthorized,
    OnlyLastAdminCanDelete,
    ChatNotFound,
    NotGroupChat,
}
