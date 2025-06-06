use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

const MAX_REACTION_LENGTH_BYTES: usize = 40;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Ord, PartialOrd, Eq, PartialEq, Hash)]
pub struct Reaction(pub String);

impl Reaction {
    pub fn new(s: String) -> Reaction {
        Reaction(s)
    }

    pub fn is_valid(&self) -> bool {
        let len = self.0.len();

        (1..=MAX_REACTION_LENGTH_BYTES).contains(&len)
    }
}

#[derive(Serialize)]
pub struct ReactionAddedEventPayload {
    pub message_type: String,
    pub chat_type: String,
    pub chat_id: String,
    pub thread: bool,
}
