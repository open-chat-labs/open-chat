use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Ord, PartialOrd, Eq, PartialEq, Hash)]
pub struct Reaction(String);

impl Reaction {
    pub fn is_valid(&self) -> bool {
        let len = self.0.len();

        1 <= len && len <= 4
    }
}
