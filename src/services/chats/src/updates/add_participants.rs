use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use shared::chat_id::ChatId;
use shared::user_id::UserId;
use shared::timestamp;
use crate::domain::chat::ChatEnum;
use crate::domain::chat_list::ChatList;
use self::Response::*;

pub fn update(chat_id: ChatId, users: Vec<UserId>) -> Response {
    let chat_list: &mut ChatList = storage::get_mut();
    let me = shared::user_id::get_current();

    let chat = chat_list.get_mut(chat_id, &me);

    match chat {
        Some(ChatEnum::Group(group_chat)) => {
            let now = timestamp::now();
            if !group_chat.is_admin(&me) {
                Unauthorized
            } else {
                let added: Vec<_> = users
                    .into_iter()
                    .filter(|u| group_chat.add_participant(u.clone(), now))
                    .collect();

                let count_added = added.len() as u32;
                for u in added.into_iter() {
                    chat_list.link_chat_to_user(chat_id, u);
                }
                Success(count_added)
            }
        },
        Some(_) => NotGroupChat,
        None => ChatNotFound
    }
}

#[derive(CandidType)]
pub enum Response {
    Success(u32),
    Unauthorized,
    ChatNotFound,
    NotGroupChat
}