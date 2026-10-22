use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::{BridgedUser, UserId};

// For a bridge bot to link an account on its platform to the OpenChat user who was given the code by
// `start_bridged_user_link`, once the bot knows who owns the account, eg. through Discord's OAuth.
// The account's profile is stored if the registry doesn't have it yet.
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user: BridgedUser,
    pub code: String,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

// The OpenChat user the account is now linked to, so the bot can tell its owner
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub user_id: UserId,
    pub username: String,
}
