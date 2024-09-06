use candid::CandidType;
use ts_export::ts_export;
use types::{MessageId, UserId};

#[ts_export(user, join_video_call)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub message_id: MessageId,
}

#[ts_export(user, join_video_call)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success,
    MessageNotFound,
    AlreadyEnded,
    UserSuspended,
    UserBlocked,
    ChatNotFound,
}
