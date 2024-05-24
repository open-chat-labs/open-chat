use serde::{Deserialize, Serialize};
use types::{ChitEarned, TimestampMillis};

#[derive(Serialize, Deserialize, Default)]
pub struct ChitEarnedEvents {
    events: Vec<ChitEarned>,
}

impl ChitEarnedEvents {
    pub fn push(&mut self, event: ChitEarned) {
        let mut sort = false;

        if let Some(latest) = self.events.last() {
            if latest.timestamp > event.timestamp {
                sort = true;
            }
        }

        self.events.push(event);

        if sort {
            self.events.sort_by_key(|e| e.timestamp);
        }
    }

    pub fn events(&self, from: Option<TimestampMillis>, max: u32, ascending: bool) -> (Vec<ChitEarned>, u32) {
        let page = if ascending {
            self.events
                .iter()
                .skip_while(|e| from.map_or(false, |ts| e.timestamp <= ts))
                .take(max as usize)
                .cloned()
                .collect()
        } else {
            self.events
                .iter()
                .rev()
                .skip_while(|e| from.map_or(false, |ts| e.timestamp >= ts))
                .take(max as usize)
                .cloned()
                .collect()
        };

        (page, self.events.len() as u32)
    }
}

#[cfg(test)]
mod tests {
    use types::ChitEarnedReason;

    use super::*;

    #[test]
    fn first_page_matches_expected() {
        let store = init_test_data();

        let (events, total) = store.events(None, 3, true);

        assert_eq!(total, 7);
        assert_eq!(events.len(), 3);
        assert_eq!(events[0].timestamp, 10);
        assert_eq!(events[2].timestamp, 12);
    }

    #[test]
    fn next_page_matches_expected() {
        let store = init_test_data();

        let (events, _) = store.events(None, 3, true);
        let (events, _) = store.events(Some(events[2].timestamp), 3, true);

        assert_eq!(events.len(), 3);
        assert_eq!(events[0].timestamp, 13);
        assert_eq!(events[2].timestamp, 15);
    }

    #[test]
    fn first_page_desc_matches_expected() {
        let store = init_test_data();

        let (events, _) = store.events(None, 3, false);

        assert_eq!(events.len(), 3);
        assert_eq!(events[0].timestamp, 16);
        assert_eq!(events[2].timestamp, 14);
    }

    #[test]
    fn next_page_desc_matches_expected() {
        let store = init_test_data();

        let (events, _) = store.events(None, 3, false);
        let (events, _) = store.events(Some(events[2].timestamp), 3, false);

        assert_eq!(events.len(), 3);
        assert_eq!(events[0].timestamp, 13);
        assert_eq!(events[2].timestamp, 11);
    }

    fn init_test_data() -> ChitEarnedEvents {
        ChitEarnedEvents {
            events: vec![
                ChitEarned {
                    amount: 200,
                    timestamp: 10,
                    reason: ChitEarnedReason::DailyClaim,
                },
                ChitEarned {
                    amount: 200,
                    timestamp: 11,
                    reason: ChitEarnedReason::DailyClaim,
                },
                ChitEarned {
                    amount: 300,
                    timestamp: 12,
                    reason: ChitEarnedReason::DailyClaim,
                },
                ChitEarned {
                    amount: 500,
                    timestamp: 13,
                    reason: ChitEarnedReason::Achievement("Bio".to_string()),
                },
                ChitEarned {
                    amount: 300,
                    timestamp: 14,
                    reason: ChitEarnedReason::DailyClaim,
                },
                ChitEarned {
                    amount: 500,
                    timestamp: 15,
                    reason: ChitEarnedReason::Achievement("Avatar".to_string()),
                },
                ChitEarned {
                    amount: 500,
                    timestamp: 16,
                    reason: ChitEarnedReason::Achievement("First message".to_string()),
                },
            ],
        }
    }
}
