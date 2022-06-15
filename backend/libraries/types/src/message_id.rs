use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug, Default, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct MessageId(u128);

impl MessageId {
    pub fn generate(mut rng: impl FnMut() -> u32) -> MessageId {
        let mut message_id_bytes = [0; 16];
        for index in (0..4).map(|i| 4 * i) {
            message_id_bytes[index..index + 4].copy_from_slice(&rng().to_ne_bytes());
        }

        MessageId(u128::from_ne_bytes(message_id_bytes))
    }
}

impl From<u128> for MessageId {
    fn from(value: u128) -> MessageId {
        MessageId(value)
    }
}
