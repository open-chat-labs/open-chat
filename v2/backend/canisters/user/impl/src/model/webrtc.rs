use std::collections::HashMap;
use types::webrtc::*;
use types::{TimestampMillis, UserId};

#[derive(Default)]
pub struct ConnectionDetailsMap {
    connection_details_per_user: HashMap<UserId, ConnectionDetails>,
}

impl ConnectionDetailsMap {
    pub fn add_offer(
        &mut self,
        id: String,
        from: UserId,
        connection_string: String,
        ice_candidates: Vec<String>,
        now: TimestampMillis,
    ) {
        self.connection_details_per_user.insert(
            from,
            ConnectionDetails::Offer(Offer {
                id,
                from,
                connection_string,
                ice_candidates,
                timestamp: now,
            }),
        );
    }

    pub fn add_answer(
        &mut self,
        id: String,
        offer_id: String,
        from: UserId,
        connection_string: String,
        ice_candidates: Vec<String>,
        now: TimestampMillis,
    ) {
        self.connection_details_per_user.insert(
            from,
            ConnectionDetails::Answer(Answer {
                id,
                offer_id,
                from,
                connection_string,
                ice_candidates,
                timestamp: now,
            }),
        );
    }

    pub fn get_connection_details(&self, updated_since: TimestampMillis) -> Vec<ConnectionDetails> {
        self.connection_details_per_user
            .values()
            .filter(|cd| cd.get_timestamp() > updated_since)
            .cloned()
            .collect()
    }

    pub fn remove_connection_details(&mut self, user_ids: &[UserId]) {
        for user_id in user_ids {
            self.connection_details_per_user.remove(user_id);
        }
    }
}
