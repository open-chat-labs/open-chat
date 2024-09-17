use candid::CandidType;
use ts_export::ts_export;
use types::{Empty, UserId};

pub type Args = Empty;

#[ts_export(user, contacts)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[ts_export(user, contacts)]
#[derive(CandidType, Debug)]
pub struct SuccessResult {
    pub contacts: Vec<Contact>,
}

#[ts_export(user, contacts)]
#[derive(CandidType, Debug)]
pub struct Contact {
    pub user_id: UserId,
    pub nickname: Option<String>,
}
