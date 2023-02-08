use candid::CandidType;
use rand_core::RngCore;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug, Default, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct MessageId(u128);

impl MessageId {
    pub fn generate<R: RngCore>(mut rng: R) -> MessageId {
        let mut message_id_bytes = [0; 16];
        rng.fill_bytes(&mut message_id_bytes);

        MessageId(u128::from_ne_bytes(message_id_bytes))
    }
}

impl From<u128> for MessageId {
    fn from(value: u128) -> MessageId {
        MessageId(value)
    }
}
