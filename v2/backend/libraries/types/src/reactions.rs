use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Ord, PartialOrd, Eq, PartialEq, Hash)]
pub struct Reaction(String);

impl Reaction {
    pub fn is_valid(&self) -> bool {
        self.0.len() <= 4
    }
}
