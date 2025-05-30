use crate::{GroupedTimerJobQueue, TimerJobItemBatch, TimerJobItemGroup};
use serde::{Deserialize, Serialize};

// Use this to process batches of events (eg. sending events to the UserIndex)
#[derive(Serialize, Deserialize)]
#[serde(bound(
    serialize = "
        <T as TimerJobItemGroup>::SharedState: Serialize,
        <T as TimerJobItemGroup>::Key: Serialize,
        <T as TimerJobItemGroup>::Item: Serialize",
    deserialize = "
        T: 'static,
        <T as TimerJobItemGroup>::SharedState: Deserialize<'de>,
        <T as TimerJobItemGroup>::Key: Deserialize<'de>,
        <T as TimerJobItemGroup>::Item: Deserialize<'de>"
))]
#[serde(transparent)]
pub struct BatchedTimerJobQueue<T: TimerJobItemBatch>(GroupedTimerJobQueue<T>);

impl<T: TimerJobItemBatch> BatchedTimerJobQueue<T> {
    pub fn new(state: T::State, defer_processing: bool) -> Self {
        Self(GroupedTimerJobQueue::new_with_state(state, 1, defer_processing))
    }

    pub fn set_state(&mut self, state: T::State) {
        self.0.set_shared_state(state);
    }

    pub fn defer_processing(&self) -> bool {
        self.0.defer_processing()
    }

    pub fn set_defer_processing(&mut self, value: bool) {
        self.0.set_defer_processing(value);
    }

    pub fn clear(&mut self) {
        self.0.clear()
    }

    pub fn len(&self) -> usize {
        self.0.len()
    }

    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }

    pub fn in_progress(&self) -> usize {
        self.0.in_progress()
    }
}

impl<T: TimerJobItemBatch + 'static> BatchedTimerJobQueue<T>
where
    <T as TimerJobItemGroup>::Key: Clone + Ord,
{
    pub fn push(&mut self, item: T::Item) {
        self.0.push((), item);
    }

    pub fn push_many(&mut self, items: Vec<T::Item>) {
        self.0.push_many((), items);
    }

    pub fn flush(&mut self) {
        self.0.flush();
    }
}

#[macro_export]
macro_rules! timer_job_batch {
    ($name:ident, $state_type:ty, $item_type:ty, $batch_size:literal) => {
        pub struct $name {
            state: $state_type,
            items: Vec<$item_type>,
        }

        impl timer_job_queues::TimerJobItemBatch for $name {
            type State = $state_type;
            type Item = $item_type;

            fn new(state: $state_type) -> Self {
                $name {
                    state,
                    items: Vec::new(),
                }
            }

            fn add(&mut self, item: $item_type) {
                self.items.push(item)
            }

            fn into_items(self) -> Vec<$item_type> {
                self.items
            }

            fn is_full(&self) -> bool {
                self.items.len() >= $batch_size
            }
        }
    };
}
