use self::Response::*;
use crate::domain::blocked_users::{BlockedStatus, BlockedUsers};
use crate::domain::chat::ChatEnum;
use crate::domain::chat_list::ChatList;
use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use shared::chat_id::ChatId;
use shared::timestamp;
use shared::user_id::UserId;

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
                // Check whether the user blocks any users to be added or vice-versa
                let blocked_users: &mut BlockedUsers = storage::get_mut();

                let mut added = Vec::new();
                let mut blocked = Vec::new();
                for u in users {
                    if blocked_users.blocked_status(&me, &u) != BlockedStatus::Unblocked {
                        blocked.push(u);
                    } else if group_chat.add_participant(u, now) {
                        added.push(u);
                    }
                }

                let count_added = added.len() as u32;
                for u in added {
                    chat_list.link_chat_to_user(chat_id, u);
                }

                if blocked.is_empty() {
                    Success(count_added)
                } else {
                    PartialSuccess(PartialSuccess {
                        count_added,
                        blocked,
                    })
                }
            }
        }
        Some(_) => NotGroupChat,
        None => ChatNotFound,
    }
}

#[derive(CandidType)]
pub struct PartialSuccess {
    count_added: u32,
    blocked: Vec<UserId>,
}

#[derive(CandidType)]
pub enum Response {
    Success(u32),
    PartialSuccess(PartialSuccess),
    Unauthorized,
    ChatNotFound,
    NotGroupChat,
}
