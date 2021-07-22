use crate::domain::user_notifications_status::UserNotificationsStatusMap;
use crate::domain::user_notifications_status::UserNotificationStatus;
use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use serde::Deserialize;
use shared::timestamp::Timestamp;
use shared::user_id::UserId;
use crate::domain::blocked_users::BlockedUsers;
use crate::domain::chat_list::ChatList;
use crate::domain::chat::ChatSummary;
use self::Response::*;

pub fn query(request: Request) -> Response {
    let chat_list: &ChatList = storage::get();
    let me = shared::user_id::get_current();

    let chats = chat_list.get_summaries(
        &me,
        request.updated_since,
        request.message_count_for_top_chat);

    let blocked_users: &BlockedUsers = storage::get();       
    let my_blocked_users = blocked_users.get(&me);

    let user_notifications_status_map: &UserNotificationsStatusMap = storage::get();
    let my_notification_status = user_notifications_status_map.get(&me);

    Success(Result::new(chats, my_blocked_users, my_notification_status))
}

#[derive(Deserialize)]
pub struct Request {
    updated_since: Option<Timestamp>,
    message_count_for_top_chat: Option<u16>,
}

#[derive(CandidType)]
pub enum Response {
    Success(Result)
}

#[derive(CandidType)]
pub struct Result {
    chats: Vec<ChatSummary>,
    blocked_users: Vec<UserId>,
    notification_status: UserNotificationStatus,
}

impl Result {
    pub fn new(chats: Vec<ChatSummary>, blocked_users: Vec<UserId>, notification_status: UserNotificationStatus) -> Result {
        Result { chats, blocked_users, notification_status }
    }
}