use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug, Clone, Copy, Hash, PartialEq, Eq)]
pub enum ReferralType {
    BtcMiami,
    User,
}
