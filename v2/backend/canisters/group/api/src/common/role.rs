use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Copy, Clone)]
pub enum Role {
    Admin,
    Participant,
}
