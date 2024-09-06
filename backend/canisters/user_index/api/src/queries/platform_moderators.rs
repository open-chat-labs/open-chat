use candid::CandidType;
use ts_export::ts_export;
use types::{Empty, UserId};

pub type Args = Empty;

#[ts_export(user_index, platform_moderators)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[ts_export(user_index, platform_moderators)]
#[derive(CandidType, Debug)]
pub struct SuccessResult {
    pub users: Vec<UserId>,
}
