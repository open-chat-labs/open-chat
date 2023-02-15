use candid::CandidType;
use serde::{Deserialize, Serialize};

const MAX_REACTION_LENGTH_BYTES: usize = 40;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Ord, PartialOrd, Eq, PartialEq, Hash)]
pub struct Reaction(String);

impl Reaction {
    pub fn new(s: String) -> Reaction {
        Reaction(s)
    }

    pub fn is_valid(&self) -> bool {
        let len = self.0.len();

        (1..=MAX_REACTION_LENGTH_BYTES).contains(&len)
    }
}
