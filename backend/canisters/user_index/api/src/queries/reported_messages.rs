use candid::CandidType;
use ts_export::ts_export;
use types::UserId;

#[ts_export(user_index, reported_messages)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub user_id: Option<UserId>,
}

#[ts_export(user_index, reported_messages)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[ts_export(user_index, reported_messages)]
#[derive(CandidType, Debug)]
pub struct SuccessResult {
    pub json: String,
}
