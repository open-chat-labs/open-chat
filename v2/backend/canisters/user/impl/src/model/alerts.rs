use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{Alert, AlertDetails, TimestampMillis};

#[derive(Serialize, Deserialize)]
pub struct Alerts {
    next_id: u32,
    map: HashMap<u32, Alert>,
}

impl Alerts {
    pub fn add(&mut self, details: AlertDetails, now: TimestampMillis) {
        let alert = Alert {
            id: self.next_id,
            timestamp: now,
            details,
        };

        self.map.insert(alert.id, alert);
        self.next_id += 1;
    }

    pub fn remove(&mut self, id: u32) -> Option<Alert> {
        self.map.remove(&id)
    }

    pub fn get_all(&self, since: Option<TimestampMillis>) -> Vec<Alert> {
        let since = since.unwrap_or_default();
        self.map.values().filter(|a| a.timestamp > since).copied().collect()
    }
}

impl Default for Alerts {
    fn default() -> Alerts {
        Alerts {
            next_id: 1,
            map: HashMap::new(),
        }
    }
}
