use candid::CandidType;
use serde::Deserialize;
use std::collections::{HashMap, HashSet};
use types::webrtc::*;
use types::{TimestampMillis, UserId};

#[derive(CandidType, Deserialize, Default)]
pub struct WebRtcSessionDetailsMap {
    session_details_by_user: HashMap<UserId, SessionDetailsEvent>,
}

impl WebRtcSessionDetailsMap {
    pub fn add(&mut self, session_details: SessionDetails, now: TimestampMillis) {
        self.session_details_by_user.insert(
            session_details.user_id(),
            SessionDetailsEvent {
                session_details,
                timestamp: now,
            },
        );
    }

    pub fn remove(&mut self, ids: &HashSet<String>) {
        self.session_details_by_user
            .retain(|_, event| !ids.contains(event.session_details.id()));
    }

    pub fn events(&self, updated_since: TimestampMillis) -> Vec<SessionDetailsEvent> {
        self.session_details_by_user
            .values()
            .filter(|event| event.timestamp > updated_since)
            .cloned()
            .collect()
    }
}
