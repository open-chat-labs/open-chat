use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;
use types::{Cryptocurrency, TimestampMillis, CanisterId, Cycles};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub username: String,
    pub token: Cryptocurrency,
    pub ledger_canister_id: CanisterId,
    pub max_individual_prize: u128,
    pub min_individual_prize: u128,
    pub min_claimants_per_message: u32,
    pub max_claimants_per_message: u32,
    pub end_date: TimestampMillis,    
    pub groups: Vec<CanisterId>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    AlreadyRegistered,
    UserLimitReached,
    UsernameTaken,
    UsernameInvalid,
    UsernameTooShort(u16),
    UsernameTooLong(u16),
    InsufficientCyclesProvided(Cycles),
    InternalError(String),
}
