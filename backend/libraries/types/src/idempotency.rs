use crate::TimestampMillis;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct IdempotentEnvelope<T> {
    pub created_at: TimestampMillis,
    pub idempotency_id: u64,
    pub value: T,
}

impl<T> IdempotentEnvelope<T> {
    pub fn map<U>(self, f: impl FnOnce(T) -> U) -> IdempotentEnvelope<U> {
        IdempotentEnvelope {
            created_at: self.created_at,
            idempotency_id: self.idempotency_id,
            value: f(self.value),
        }
    }
}

// Temp hack to allow us to release this in a non-breaking way
impl<T> From<T> for IdempotentEnvelope<T> {
    fn from(value: T) -> Self {
        IdempotentEnvelope {
            created_at: 0,
            idempotency_id: 0,
            value,
        }
    }
}
