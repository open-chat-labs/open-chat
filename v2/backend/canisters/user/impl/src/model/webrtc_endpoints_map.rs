use std::collections::{HashMap, HashSet};
use types::webrtc::*;
use types::{TimestampMillis, UserId};

#[derive(Default)]
pub struct WebRtcEndpointsMap {
    endpoints_by_user: HashMap<UserId, EndpointEvent>,
}

impl WebRtcEndpointsMap {
    pub fn add(&mut self, event: EndpointEvent) {
        self.endpoints_by_user.insert(event.endpoint.user_id, event);
    }

    pub fn remove(&mut self, ids: &HashSet<String>) {
        self.endpoints_by_user.retain(|_, event| !ids.contains(&event.endpoint.id));
    }

    pub fn events(&self, updated_since: TimestampMillis) -> Vec<EndpointEvent> {
        self.endpoints_by_user
            .values()
            .filter(|event| event.timestamp > updated_since)
            .cloned()
            .collect()
    }
}
