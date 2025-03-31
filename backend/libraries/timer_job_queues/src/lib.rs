mod batched_timer_job_queue;
mod grouped_timer_job_queue;
mod timer_job_queue;

pub use batched_timer_job_queue::BatchedTimerJobQueue;
pub use grouped_timer_job_queue::{deserialize_batched_timer_job_queue_from_previous, GroupedTimerJobQueue};
pub use timer_job_queue::TimerJobQueue;

pub trait TimerJobItem {
    fn process(&self) -> impl std::future::Future<Output = Result<(), bool>> + Send;
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
