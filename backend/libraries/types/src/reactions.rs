use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Ord, PartialOrd, Eq, PartialEq, Hash)]
pub struct Reaction(pub String);

impl Reaction {
    pub fn new(s: String) -> Reaction {
        Reaction(s)
    }

    pub fn is_valid(&self) -> bool {
        let len = self.0.len();
        let max_length = if self.0.starts_with("@CustomEmoji(") { 100 } else { 40 };
        (1..=max_length).contains(&len)
    }
}

#[derive(Serialize)]
pub struct ReactionAddedEventPayload {
    pub message_type: String,
    pub chat_type: String,
    pub chat_id: String,
    pub thread: bool,
}
