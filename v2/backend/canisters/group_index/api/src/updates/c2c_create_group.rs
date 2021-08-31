use candid::{CandidType, Principal};
use serde::Deserialize;
use types::ChatId;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub is_public: bool,
    pub creator_principal: Principal,
    pub name: String,
    pub description: String,
    pub history_visible_to_new_joiners: bool,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    PublicGroupAlreadyExists,
    CyclesBalanceTooLow,
    InternalError,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub chat_id: ChatId,
}
