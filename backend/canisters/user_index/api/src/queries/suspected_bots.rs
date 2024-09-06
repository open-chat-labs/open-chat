use candid::CandidType;
use ts_export::ts_export;
use types::UserId;

#[ts_export(user_index, suspected_bots)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub after: Option<UserId>,
    pub count: u32,
}

#[ts_export(user_index, suspected_bots)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[ts_export(user_index, suspected_bots)]
#[derive(CandidType, Debug)]
pub struct SuccessResult {
    pub users: Vec<UserId>,
}
