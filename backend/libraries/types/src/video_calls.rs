use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default, Eq, PartialEq)]
pub enum VideoCallPresence {
    #[default]
    Default,
    Owner,
    Hidden,
}
