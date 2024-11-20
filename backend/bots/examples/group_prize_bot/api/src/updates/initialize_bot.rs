use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;
use types::{CanisterId, Cryptocurrency, Cycles, TimestampMillis};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub username: String,
    pub token: Cryptocurrency,
    pub ledger_canister_id: CanisterId,
    pub prizes: Vec<Vec<u64>>,
    pub end_date: TimestampMillis,
    pub update_existing: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    EndDateInPast,
    AlreadyRegistered,
    UserLimitReached,
    UsernameTaken,
    UsernameInvalid,
    UsernameTooShort(u16),
    UsernameTooLong(u16),
    InsufficientCyclesProvided(Cycles),
    InternalError(String),
}

impl From<user_index_canister::c2c_register_bot::Response> for Response {
    fn from(value: user_index_canister::c2c_register_bot::Response) -> Self {
        use user_index_canister::c2c_register_bot::Response as R;

        match value {
            R::Success => Self::Success,
            R::AlreadyRegistered => Self::AlreadyRegistered,
            R::UserLimitReached => Self::UserLimitReached,
            R::UsernameTaken => Self::UsernameTaken,
            R::UsernameInvalid => Self::UsernameInvalid,
            R::UsernameTooShort(min_length) => Self::UsernameTooShort(min_length),
            R::UsernameTooLong(max_length) => Self::UsernameTooLong(max_length),
            R::InsufficientCyclesProvided(cycles_required) => Self::InsufficientCyclesProvided(cycles_required),
            R::InternalError(error) => Self::InternalError(error),
            R::DisplayNameInvalid | R::DisplayNameTooShort(_) | R::DisplayNameTooLong(_) => unreachable!(),
        }
    }
}
