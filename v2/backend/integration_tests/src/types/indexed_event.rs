use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Clone)]
pub struct IndexedEvent<T: CandidType + Clone> {
    pub value: T,
    pub index: u64,
}
