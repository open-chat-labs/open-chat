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
    type Args: Clone;
    type Item;

    fn new(args: Self::Args) -> Self;
    fn add(&mut self, item: Self::Item);
    fn into_items(self) -> Vec<Self::Item>;
    fn is_full(&self) -> bool;
}

pub trait TimerJobItemGroup: TimerJobItem {
    type CommonArgs: Clone;
    type Key: Clone + Ord;
    type Item;

    fn new(common_args: Self::CommonArgs, grouping_key: Self::Key) -> Self;
    fn key(&self) -> Self::Key;
    fn add(&mut self, item: Self::Item);
    fn into_items(self) -> Vec<Self::Item>;
    fn is_full(&self) -> bool;
}

impl<T: TimerJobItemBatch> TimerJobItemGroup for T {
    type CommonArgs = T::Args;
    type Key = ();
    type Item = T::Item;

    fn new(common_args: Self::CommonArgs, _: Self::Key) -> Self {
        T::new(common_args)
    }

    fn key(&self) -> Self::Key {
        ()
    }

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
