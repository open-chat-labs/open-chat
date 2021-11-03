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
}

impl Alerts {
    pub fn add(&mut self, details: AlertDetails, now: TimestampMillis) {
        let alert = AlertInternal {
            id: self.next_id,
            timestamp: now,
            details,
        };

        self.map.insert(alert.id, alert);
        self.next_id += 1;
    }

    pub fn remove(&mut self, id: u32) -> Option<AlertInternal> {
        self.map.remove(&id)
    }

    pub fn get_all(&self, since: Option<TimestampMillis>, now: TimestampMillis) -> Vec<Alert> {
        let since = since.unwrap_or_default();
        self.map
            .values()
            .filter(|a| a.timestamp > since)
            .map(|a| Alerts::to_alert(a, now))
            .collect()
    }

    fn to_alert(alert: &AlertInternal, now: TimestampMillis) -> Alert {
        Alert {
            id: AlertId::Internal(alert.id).to_string(),
            elapsed: now - alert.timestamp,
            details: alert.details.clone(),
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
