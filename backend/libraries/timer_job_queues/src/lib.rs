use types::Milliseconds;

mod batched_timer_job_queue;
mod grouped_timer_job_queue;
mod timer_job_queue;

pub use batched_timer_job_queue::BatchedTimerJobQueue;
pub use grouped_timer_job_queue::GroupedTimerJobQueue;
pub use timer_job_queue::TimerJobQueue;

// Items which keep failing are dropped rather than retried forever. Without a cap a permanently
// broken callee - one which has been uninstalled, or which no longer has the method we are calling
// - pins its items in the queue for good and the queue only ever grows. The IC does not tell
// canisters which of these it is hitting (it exposes only the coarse `RejectCode`, not the fine
// grained error codes), so we cannot single the permanent failures out up front and have to bound
// the retries instead.
const MAX_CONSECUTIVE_FAILURES: u32 = 50;

// Records a failed attempt, returning true if the items should be retried and false if they have
// failed too many times in a row and should be dropped. The count resets once they are dropped, so
// items queued for the same target afterwards get a fresh set of attempts.
fn should_retry_after_failure(consecutive_failures: &mut u32) -> bool {
    *consecutive_failures = consecutive_failures.saturating_add(1);
    if *consecutive_failures < MAX_CONSECUTIVE_FAILURES {
        true
    } else {
        *consecutive_failures = 0;
        false
    }
}

pub trait TimerJobItem {
    fn process(&self) -> impl Future<Output = Result<(), Option<Milliseconds>>> + Send;
}

pub trait TimerJobItemBatch: TimerJobItem {
    type State: Clone;
    type Item;

    fn new(state: Self::State) -> Self;
    fn add(&mut self, item: Self::Item);
    fn into_items(self) -> Vec<Self::Item>;
    fn is_full(&self) -> bool;
}

pub trait TimerJobItemGroup: TimerJobItem {
    type SharedState: Clone;
    type Key: Clone + Ord;
    type Item;

    fn new(state: Self::SharedState, grouping_key: Self::Key) -> Self;
    fn key(&self) -> Self::Key;
    fn add(&mut self, item: Self::Item);
    fn into_items(self) -> Vec<Self::Item>;
    fn is_full(&self) -> bool;
}

impl<T: TimerJobItemBatch> TimerJobItemGroup for T {
    type SharedState = T::State;
    type Key = ();
    type Item = T::Item;

    fn new(state: Self::SharedState, _: Self::Key) -> Self {
        T::new(state)
    }

    fn key(&self) {}

    fn add(&mut self, item: Self::Item) {
        self.add(item);
    }

    fn into_items(self) -> Vec<Self::Item> {
        self.into_items()
    }

    fn is_full(&self) -> bool {
        self.is_full()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn items_are_retried_until_the_cap_is_reached() {
        let mut consecutive_failures = 0;

        for attempt in 1..MAX_CONSECUTIVE_FAILURES {
            assert!(
                should_retry_after_failure(&mut consecutive_failures),
                "attempt {attempt} should still be retried"
            );
        }

        assert!(!should_retry_after_failure(&mut consecutive_failures));
    }

    #[test]
    fn dropping_the_items_resets_the_count() {
        let mut consecutive_failures = 0;
        while should_retry_after_failure(&mut consecutive_failures) {}

        assert_eq!(consecutive_failures, 0);
        // The next lot of items get a fresh set of attempts rather than being dropped immediately
        assert!(should_retry_after_failure(&mut consecutive_failures));
    }

    #[test]
    fn a_success_between_failures_prevents_the_items_being_dropped() {
        let mut consecutive_failures = 0;

        for _ in 0..MAX_CONSECUTIVE_FAILURES * 2 {
            assert!(should_retry_after_failure(&mut consecutive_failures));
            // A success resets the count, so only consecutive failures count towards the cap
            consecutive_failures = 0;
        }
    }
}
