use candid::CandidType;
use serde::Deserialize;
use shared::time::TimestampMillis;

#[derive(CandidType, Deserialize, Debug, Eq, PartialEq)]
pub struct Subscription {
    json: String,
    last_active: TimestampMillis,
}

impl Subscription {
    pub fn new(json: String, now: TimestampMillis) -> Subscription {
        Subscription { json, last_active: now }
    }

    pub fn json(&self) -> &str {
        &self.json
    }

    pub fn last_active(&self) -> TimestampMillis {
        self.last_active
    }

    pub fn set_last_active(&mut self, now: TimestampMillis) {
        self.last_active = now;
    }
}
