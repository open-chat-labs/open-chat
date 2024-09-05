use candid::CandidType;
use ts_export::ts_export;
use types::UserId;

#[ts_export(user, unblock_user)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub user_id: UserId,
}

#[ts_export(user, unblock_user)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success,
    UserSuspended,
}
