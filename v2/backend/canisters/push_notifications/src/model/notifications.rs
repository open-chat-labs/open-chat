use crate::model::notification::{IndexedNotification, Notification};
use candid::CandidType;
use serde::Deserialize;
use std::cmp::{max, min};
use std::collections::VecDeque;

const MAX_NOTIFICATIONS: usize = 100_000;

#[derive(CandidType, Deserialize, Default)]
pub struct Notifications {
    notifications: VecDeque<IndexedNotification>,
}

impl Notifications {
    pub fn get(&self, from_notification_index: u64, max_notifications: u32) -> Vec<IndexedNotification> {
        if let Some(earliest_notification_index) = self.notifications.front().map(|e| e.index) {
            let latest_notification_index = self.notifications.back().unwrap().index;
            if from_notification_index > latest_notification_index {
                return Vec::new();
            }

            let from_notification_index = max(from_notification_index, earliest_notification_index);

            let start_index = (from_notification_index - earliest_notification_index) as usize;
            let end_index = min(start_index + (max_notifications as usize), self.notifications.len());

            (start_index..end_index)
                .filter_map(|i| self.notifications.get(i))
                .cloned()
                .collect()
        } else {
            Vec::new()
        }
    }

    pub fn add(&mut self, notification: Notification) -> u64 {
        let notification_index = self.notifications.back().map(|e| e.index + 1).unwrap_or(0);
        self.notifications.push_back(IndexedNotification {
            index: notification_index,
            notification,
        });

        while self.notifications.len() > MAX_NOTIFICATIONS {
            self.notifications.pop_front();
        }

        notification_index
    }

    pub fn remove(&mut self, up_to_notification_index: u64) -> u32 {
        if let Some(earliest_notification_index) = self.notifications.front().map(|e| e.index) {
            if earliest_notification_index <= up_to_notification_index {
                let count_to_remove = (up_to_notification_index + 1 - earliest_notification_index) as usize;

                return self.notifications.drain(0..count_to_remove).len() as u32;
            }
        }
        0
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::notification::DirectMessageNotification;
    use candid::Principal;
    use shared::types::notifications::Subscription;

    #[test]
    fn add() {
        let mut notifications_collection = Notifications::default();

        for i in 0..10 {
            let notification = DirectMessageNotification {
                sender: Principal::from_slice(&[i]).into(),
                recipient: Principal::from_slice(&[i + 1]).into(),
                message_index: i.into(),
            };
            notifications_collection.add(Notification::DirectMessageNotification(notification));
        }

        assert_eq!(notifications_collection.notifications.len(), 10);

        for i in 0..10 {
            let indexed_notification = &notifications_collection.notifications[i];
            assert_eq!(indexed_notification.index, i as u64);
            if let Notification::DirectMessageNotification(n) = &indexed_notification.notification {
                assert_eq!(n.message_index.into(), i);
            } else {
                panic!();
            }
        }
    }

    #[test]
    fn get_from_start() {
        let mut notifications_collection = Notifications::default();

        for i in 0..10 {
            let notification = DirectMessageNotification {
                sender: Principal::from_slice(&[i]).into(),
                recipient: Principal::from_slice(&[i + 1]).into(),
                message_index: i.into(),
            };
            notifications_collection.add(Notification::DirectMessageNotification(notification));
        }

        let notifications = notifications_collection.get(0, 5);

        assert_eq!(notifications.len(), 5);

        for i in 0..5 {
            let indexed_notification = &notifications[i];
            assert_eq!(indexed_notification.index, i as u64);
            if let Notification::DirectMessageNotification(n) = &indexed_notification.notification {
                assert_eq!(n.message_index.into(), i);
            } else {
                panic!();
            }
        }
    }

    #[test]
    fn get_with_offset() {
        let mut notifications_collection = Notifications::default();

        for i in 0..10 {
            let notification = DirectMessageNotification {
                sender: Principal::from_slice(&[i]).into(),
                recipient: Principal::from_slice(&[i + 1]).into(),
                message_index: i.into(),
            };
            notifications_collection.add(Notification::DirectMessageNotification(notification));
        }

        let notifications = notifications_collection.get(5, 5);

        assert_eq!(notifications.len(), 5);

        for i in 5..10 {
            let indexed_notification = &notifications[i - 5];
            assert_eq!(indexed_notification.index, i as u64);
            if let Notification::DirectMessageNotification(n) = &indexed_notification.notification {
                assert_eq!(n.message_index.into(), i);
            } else {
                panic!();
            }
        }
    }

    #[test]
    fn get_with_request_exceeding_data_range() {
        let mut notifications_collection = Notifications::default();

        for i in 0..10 {
            let notification = DirectMessageNotification {
                sender: Principal::from_slice(&[i]).into(),
                recipient: Principal::from_slice(&[i + 1]).into(),
                message_index: i.into(),
            };
            notifications_collection.add(Notification::DirectMessageNotification(notification));
        }

        let notifications = notifications_collection.get(5, 10);

        assert_eq!(notifications.len(), 5);

        for i in 5..10 {
            let indexed_notification = &notifications[i - 5];
            assert_eq!(indexed_notification.index, i as u64);
            if let Notification::DirectMessageNotification(n) = &indexed_notification.notification {
                assert_eq!(n.message_index.into(), i);
            } else {
                panic!();
            }
        }
    }

    #[test]
    fn remove() {
        let mut notifications_collection = Notifications::default();

        for i in 0..10 {
            let notification = DirectMessageNotification {
                sender: Principal::from_slice(&[i]).into(),
                recipient: Principal::from_slice(&[i + 1]).into(),
                message_index: i.into(),
            };
            notifications_collection.add(Notification::DirectMessageNotification(notification));
        }

        assert_eq!(notifications_collection.remove(4), 5);

        let notifications = notifications_collection.get(0, 5);

        assert_eq!(notifications.len(), 5);

        for i in 5..10 {
            let indexed_notification = &notifications[i - 5];
            assert_eq!(indexed_notification.index, i as u64);
            if let Notification::DirectMessageNotification(n) = &indexed_notification.notification {
                assert_eq!(n.message_index.into(), i);
            } else {
                panic!();
            }
        }

        assert_eq!(notifications_collection.remove(4), 0);
        assert_eq!(notifications_collection.remove(9), 5);
        assert!(notifications_collection.notifications.is_empty());
    }
}
