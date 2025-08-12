use serde::{Deserialize, Serialize};
use std::ops::Range;
use types::{ChitEvent, ChitEventType, TimestampMillis};
use utils::time::MonthKey;

#[derive(Serialize, Deserialize, Default)]
pub struct ChitEvents {
    events: Vec<ChitEvent>,
    total_chit_earned: i32,
    #[serde(default)]
    total_chit_spent: i32,
}

impl ChitEvents {
    pub fn push(&mut self, event: ChitEvent) {
        let mut sort = false;

        if let Some(latest) = self.events.last()
            && latest.timestamp > event.timestamp
        {
            sort = true;
        }

        if event.amount >= 0 {
            self.total_chit_earned += event.amount;
        } else {
            self.total_chit_spent += event.amount.abs();
        }
        self.events.push(event);

        if sort {
            self.events.sort_by_key(|e| e.timestamp);
        }
    }

    pub fn events(
        &self,
        from: Option<TimestampMillis>,
        to: Option<TimestampMillis>,
        skip: usize,
        max: usize,
        ascending: bool,
    ) -> (Vec<ChitEvent>, u32) {
        if ascending {
            let range = self.range(from.unwrap_or_default()..to.unwrap_or(TimestampMillis::MAX));
            (range.iter().skip(skip).take(max).cloned().collect(), range.len() as u32)
        } else {
            let range = self.range(to.unwrap_or_default()..from.unwrap_or(TimestampMillis::MAX));
            (range.iter().rev().skip(skip).take(max).cloned().collect(), range.len() as u32)
        }
    }

    pub fn total_chit_earned(&self) -> i32 {
        self.total_chit_earned
    }

    pub fn chit_balance(&self) -> i32 {
        self.total_chit_earned - self.total_chit_spent
    }

    pub fn balance_for_month_by_timestamp(&self, ts: TimestampMillis) -> i32 {
        self.balance_for_month(MonthKey::from_timestamp(ts))
    }

    pub fn balance_for_month(&self, month: MonthKey) -> i32 {
        let timestamp_range = month.timestamp_range();
        let range = self.range(timestamp_range);
        range.iter().map(|e| e.amount).sum()
    }

    pub fn achievements(&self, since: Option<TimestampMillis>) -> Vec<ChitEvent> {
        self.events
            .iter()
            .rev()
            .take_while(|e| since.is_none_or(|ts| e.timestamp > ts))
            .filter(|e| {
                matches!(
                    e.reason,
                    ChitEventType::Achievement(_) | ChitEventType::ExternalAchievement(_)
                )
            })
            .cloned()
            .collect()
    }

    pub fn iter_daily_claims(&self) -> impl DoubleEndedIterator<Item = TimestampMillis> + '_ {
        self.events
            .iter()
            .filter(|e| {
                matches!(
                    e.reason,
                    ChitEarnedReason::DailyClaim
                        | ChitEarnedReason::DailyClaimReinstated
                        | ChitEarnedReason::StreakInsuranceClaim
                )
            })
            .map(|e| e.timestamp)
    }

    pub fn last_updated(&self) -> TimestampMillis {
        self.events.last().map(|e| e.timestamp).unwrap_or_default()
    }

    fn range(&self, range: Range<TimestampMillis>) -> &[ChitEvent] {
        let start = self.events.partition_point(|e| e.timestamp < range.start);
        let end = self.events.partition_point(|e| e.timestamp <= range.end);

        &self.events[start..end]
    }
}

#[cfg(test)]
mod tests {
    use types::{Achievement, ChitEventType};

    use super::*;

    #[test]
    fn first_page_matches_expected() {
        let store = init_test_data();

        let (events, total) = store.events(None, None, 0, 3, true);

        assert_eq!(total, 7);
        assert_eq!(events.len(), 3);
        assert_eq!(events[0].timestamp, 10);
        assert_eq!(events[2].timestamp, 12);
    }

    #[test]
    fn next_page_matches_expected() {
        let store = init_test_data();

        let (events, _) = store.events(None, None, 3, 3, true);

        assert_eq!(events.len(), 3);
        assert_eq!(events[0].timestamp, 13);
        assert_eq!(events[2].timestamp, 15);
    }

    #[test]
    fn first_page_desc_matches_expected() {
        let store = init_test_data();

        let (events, _) = store.events(None, None, 0, 3, false);

        assert_eq!(events.len(), 3);
        assert_eq!(events[0].timestamp, 16);
        assert_eq!(events[2].timestamp, 14);
    }

    #[test]
    fn next_page_desc_matches_expected() {
        let store = init_test_data();

        let (events, _) = store.events(None, None, 3, 3, false);

        assert_eq!(events.len(), 3);
        assert_eq!(events[0].timestamp, 13);
        assert_eq!(events[2].timestamp, 11);
    }

    #[test]
    fn range_matches_expected() {
        let store = init_test_data();

        let (events, _) = store.events(Some(12), Some(15), 0, 99, true);

        assert_eq!(events.len(), 4);
        assert_eq!(events[0].timestamp, 12);
        assert_eq!(events[3].timestamp, 15);
    }

    #[test]
    fn range_desc_matches_expected() {
        let store = init_test_data();

        let (events, _) = store.events(Some(14), Some(11), 0, 99, false);

        assert_eq!(events.len(), 4);
        assert_eq!(events[0].timestamp, 14);
        assert_eq!(events[3].timestamp, 11);
    }

    fn init_test_data() -> ChitEvents {
        let events = vec![
            ChitEvent {
                amount: 200,
                timestamp: 10,
                reason: ChitEventType::DailyClaim,
            },
            ChitEvent {
                amount: 200,
                timestamp: 11,
                reason: ChitEventType::DailyClaim,
            },
            ChitEvent {
                amount: 300,
                timestamp: 12,
                reason: ChitEventType::DailyClaim,
            },
            ChitEvent {
                amount: 500,
                timestamp: 13,
                reason: ChitEventType::Achievement(Achievement::SetBio),
            },
            ChitEvent {
                amount: 300,
                timestamp: 14,
                reason: ChitEventType::DailyClaim,
            },
            ChitEvent {
                amount: 500,
                timestamp: 15,
                reason: ChitEventType::Achievement(Achievement::SetAvatar),
            },
            ChitEvent {
                amount: 500,
                timestamp: 16,
                reason: ChitEventType::Achievement(Achievement::SentDirectMessage),
            },
        ];
        let total_chit_earned = events.iter().map(|e| e.amount).sum();

        ChitEvents {
            events,
            total_chit_earned,
            total_chit_spent: 0,
        }
    }
}
