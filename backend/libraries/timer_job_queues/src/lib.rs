mod grouped_timer_job_queue;
mod timer_job_queue;

pub use timer_job_queue::TimerJobQueue;

pub trait TimerJobItem {
    fn process(&self) -> impl std::future::Future<Output = Result<(), bool>> + Send;
}

pub trait TimerJobItemGroup: TimerJobItem {
    type Key: Clone + Ord;
    type Item;

    fn new(grouping_key: Self::Key) -> Self;
    fn key(&self) -> Self::Key;
    fn add(&mut self, item: Self::Item);
    fn into_items(self) -> Vec<Self::Item>;
    fn is_full(&self) -> bool;
}
