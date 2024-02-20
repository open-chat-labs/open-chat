use candid::CandidType;
use serde::{Deserialize, Serialize};

use crate::MessageIndex;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum AccessTokenType {
    StartVideoCall,
    JoinVideoCall(MessageIndex),
}
