use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct IndexedEvent<T: CandidType + Clone> {
    pub value: T,
    pub index: u64,
}
