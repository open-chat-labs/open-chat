use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct IndexedEvent<T: CandidType + Clone> {
    pub value: T,
    pub index: u64,
}
