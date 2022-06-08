use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChallengeAttempt, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub username: String,
    pub challenge_attempt: ChallengeAttempt,
    pub referred_by: Option<UserId>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(UserId),
    AlreadyRegistered,
    UserLimitReached,
    UsernameTaken,
    UsernameInvalid,
    UsernameTooShort(u16),
    UsernameTooLong(u16),
    CyclesBalanceTooLow,
    InternalError(String),
    ChallengeFailed,
}
