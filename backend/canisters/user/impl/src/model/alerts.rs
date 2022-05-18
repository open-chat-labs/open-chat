use itertools::Itertools;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{Alert, AlertDetails, AlertId, TimestampMillis};

#[derive(Serialize, Deserialize)]
pub struct Alerts {
    next_id: u32,
    map: HashMap<u32, AlertInternal>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AlertInternal {
    pub id: u32,
    pub timestamp: TimestampMillis,
    pub details: AlertDetails,
    pub read: bool,
}

impl Alerts {
    pub fn add(&mut self, details: AlertDetails, now: TimestampMillis) -> u32 {
        let id = self.next_id;
        let alert = AlertInternal {
            id,
            timestamp: now,
            details,
            read: false,
        };

        self.map.insert(alert.id, alert);
        self.next_id += 1;
        id
    }

    pub fn mark_read(&mut self, id: u32) -> bool {
        if let Some(alert) = self.map.get_mut(&id) {
            alert.read = true;
            true
        } else {
            false
        }
    }

    pub fn get_all(&self, since: Option<TimestampMillis>, now: TimestampMillis) -> Vec<Alert> {
        let since = since.unwrap_or_default();
        self.map
            .values()
            .filter(|a| a.timestamp > since)
            .map(|a| Alerts::to_alert(a, now))
            .sorted_unstable_by_key(|a| a.timestamp)
            .rev()
            .collect()
    }

    fn to_alert(alert: &AlertInternal, now: TimestampMillis) -> Alert {
        Alert {
            id: AlertId::Internal(alert.id).to_string(),
            timestamp: alert.timestamp,
            elapsed: now - alert.timestamp,
            details: alert.details.clone(),
            read: alert.read,
        }
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
