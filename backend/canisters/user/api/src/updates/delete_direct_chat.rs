use candid::CandidType;
use ts_export::ts_export;
use types::UserId;

#[ts_export(user, delete_direct_chat)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub block_user: bool,
}

#[ts_export(user, delete_direct_chat)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success,
    ChatNotFound,
}
