use crate::TimestampMillis;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct IdempotentMessage<T> {
    pub created_at: TimestampMillis,
    pub idempotency_id: u64,
    pub value: T,
}

// Temp hack to allow us to release this in a non-breaking way
impl<T> From<T> for IdempotentMessage<T> {
    fn from(value: T) -> Self {
        IdempotentMessage {
            created_at: 0,
            idempotency_id: 0,
            value,
        }
    }
}
