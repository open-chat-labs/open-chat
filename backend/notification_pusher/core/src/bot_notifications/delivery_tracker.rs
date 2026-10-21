use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};

// Tracks the bot notifications read from one notifications canister which are yet to be delivered,
// so the reader only records the bot notifications as processed up to the oldest of them. Then
// after a restart the pusher sends them again rather than losing them.
#[derive(Default)]
pub struct DeliveryTracker {
    // The number of deliveries still to finish for each notification index, as a notification can
    // go to several bots
    pending: Mutex<BTreeMap<u64, usize>>,
}

impl DeliveryTracker {
    pub fn start(self: &Arc<Self>, index: u64) -> PendingDelivery {
        *self.pending.lock().unwrap().entry(index).or_default() += 1;

        PendingDelivery {
            tracker: self.clone(),
            index,
        }
    }

    // Given every notification up to `read_up_to` has been read, every bot notification up to the
    // returned index has been delivered, or given up on
    pub fn finished_up_to(&self, read_up_to: u64) -> u64 {
        self.pending
            .lock()
            .unwrap()
            .first_key_value()
            .map_or(read_up_to, |(index, _)| index.saturating_sub(1).min(read_up_to))
    }

    fn finish(&self, index: u64) {
        let mut pending = self.pending.lock().unwrap();
        if let Some(count) = pending.get_mut(&index) {
            *count -= 1;
            if *count == 0 {
                pending.remove(&index);
            }
        }
    }
}

// Finishes the delivery when dropped, however it ended: delivered, rejected, given up on, or
// dropped because the bot's queue was full
pub struct PendingDelivery {
    tracker: Arc<DeliveryTracker>,
    index: u64,
}

impl Drop for PendingDelivery {
    fn drop(&mut self) {
        self.tracker.finish(self.index);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finished_up_to_the_oldest_pending_delivery() {
        let tracker = Arc::new(DeliveryTracker::default());
        assert_eq!(tracker.finished_up_to(10), 10);

        let first = tracker.start(4);
        let second_a = tracker.start(7);
        let second_b = tracker.start(7);
        assert_eq!(tracker.finished_up_to(10), 3);

        drop(first);
        assert_eq!(tracker.finished_up_to(10), 6);

        // Index 7 went to two bots, so it isn't finished until both deliveries are
        drop(second_a);
        assert_eq!(tracker.finished_up_to(10), 6);
        drop(second_b);
        assert_eq!(tracker.finished_up_to(10), 10);
    }

    #[test]
    fn never_past_what_has_been_read() {
        let tracker = Arc::new(DeliveryTracker::default());
        let _pending = tracker.start(20);
        assert_eq!(tracker.finished_up_to(10), 10);
    }
}
