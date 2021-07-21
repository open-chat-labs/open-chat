use candid::CandidType;
use serde::Deserialize;
use shared::time::TimestampMillis;

#[derive(CandidType, Deserialize, Debug, Eq, PartialEq)]
pub struct Subscription {
    connection_string: String,
    last_active: TimestampMillis,
}

impl Subscription {
    pub fn new(connection_string: String, now: TimestampMillis) -> Subscription {
        Subscription {
            connection_string,
            last_active: now,
        }
    }

    pub fn get_connection_string(&self) -> &str {
        &self.connection_string
    }

    pub fn get_last_active(&self) -> TimestampMillis {
        self.last_active
    }

    pub fn set_last_active(&mut self, now: TimestampMillis) {
        self.last_active = now;
    }
}
