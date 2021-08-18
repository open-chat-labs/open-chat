use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug, Default, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct MessageId(u128);

impl From<u128> for MessageId {
    fn from(value: u128) -> MessageId {
        MessageId(value)
    }
}
