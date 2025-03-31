use crate::{BatchedTimerJobQueue, TimerJobItemBatch, TimerJobItemGroup};
use ic_cdk_timers::TimerId;
use ic_principal::Principal;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::collections::btree_map::Entry::{Occupied, Vacant};
use std::collections::{BTreeMap, BTreeSet, VecDeque};
use std::marker::PhantomData;
use std::ops::DerefMut;
use std::rc::Rc;
use std::sync::Mutex;
use std::time::Duration;

// Use this to process events where events are grouped into batches based on their key.
// Eg. sending events to User canisters (in this case the User canisterId would be the key).
#[allow(clippy::type_complexity)]
pub struct GroupedTimerJobQueue<T: TimerJobItemGroup> {
    inner: Rc<Mutex<GroupedTimerJobQueueInner<T::CommonArgs, T::Key, T::Item>>>,
    phantom: PhantomData<T>,
}

impl<T: TimerJobItemGroup> GroupedTimerJobQueue<T> {
    pub fn new(args: T::CommonArgs, max_concurrency: usize, defer_processing: bool) -> Self {
        Self {
            inner: Rc::new(Mutex::new(GroupedTimerJobQueueInner {
                args,
                queue: VecDeque::new(),
                items_map: BTreeMap::new(),
                in_progress: BTreeSet::new(),
                max_concurrency,
                defer_processing,
                timer_id: None,
            })),
            phantom: PhantomData,
        }
    }

    pub fn set_common_args(&mut self, args: T::CommonArgs) {
        self.within_lock(|i| i.args = args);
    }

    pub fn max_concurrency(&self) -> usize {
        self.within_lock(|i| i.max_concurrency)
    }

    pub fn set_max_concurrency(&self, value: usize) {
        self.within_lock(|i| i.max_concurrency = value)
    }

    pub fn defer_processing(&self) -> bool {
        self.within_lock(|i| i.defer_processing)
    }

    pub fn set_defer_processing(&self, value: bool) {
        self.within_lock(|i| i.defer_processing = value)
    }

    pub fn clear(&self) {
        self.within_lock(|i| i.queue.clear())
    }

    pub fn len(&self) -> usize {
        self.within_lock(|i| i.items_map.values().map(|v| v.len()).sum())
    }

    pub fn is_empty(&self) -> bool {
        self.within_lock(|i| i.queue.is_empty())
    }

    pub fn in_progress(&self) -> usize {
        self.within_lock(|i| i.in_progress.len())
    }

    fn within_lock<F: FnOnce(&mut GroupedTimerJobQueueInner<T::CommonArgs, T::Key, T::Item>) -> R, R>(&self, f: F) -> R {
        let mut inner = self.inner.try_lock().unwrap();
        f(inner.deref_mut())
    }
}

#[derive(Serialize, Deserialize)]
struct GroupedTimerJobQueueInner<A: Clone, K: Clone + Ord, I> {
    args: A,
    queue: VecDeque<K>,
    items_map: BTreeMap<K, VecDeque<I>>,
    in_progress: BTreeSet<K>,
    max_concurrency: usize,
    defer_processing: bool,
    #[serde(skip)]
    timer_id: Option<TimerId>,
}

impl<T: TimerJobItemGroup + 'static> GroupedTimerJobQueue<T>
where
    <T as TimerJobItemGroup>::Key: Clone + Ord,
{
    pub fn push(&mut self, grouping_key: T::Key, item: T::Item) {
        self.push_many(grouping_key, vec![item])
    }

    pub fn push_many(&mut self, grouping_key: T::Key, items: Vec<T::Item>) {
        if items.is_empty() {
            return;
        }

        let defer_processing = self.within_lock(|i| {
            match i.items_map.entry(grouping_key.clone()) {
                Vacant(e) => {
                    e.insert(VecDeque::from(items));
                    i.queue.push_back(grouping_key);
                }
                Occupied(mut e) => {
                    e.get_mut().extend(items);
                }
            }
            i.defer_processing
        });

        if defer_processing {
            self.set_timer_if_required();
        } else {
            self.flush();
        }
    }

    pub fn flush(&self) {
        let mut batches = Vec::new();

        self.within_lock(|i| {
            let max_to_start = i.max_concurrency.saturating_sub(i.in_progress.len());
            while batches.len() < max_to_start {
                if let Some(grouping_key) = i.queue.pop_front() {
                    if let Occupied(mut e) = i.items_map.entry(grouping_key.clone()) {
                        // If this key is already being processed, skip it
                        if !i.in_progress.insert(grouping_key.clone()) {
                            continue;
                        }

                        let mut batch = T::new(i.args.clone(), grouping_key);
                        let mut empty_batch = true;
                        let queue = e.get_mut();
                        loop {
                            if let Some(next) = queue.pop_front() {
                                batch.add(next);
                                empty_batch = false;
                            } else {
                                break;
                            }
                            if batch.is_full() {
                                break;
                            }
                        }
                        if queue.is_empty() {
                            e.remove();
                        }
                        if !empty_batch {
                            batches.push(batch);
                        } else {
                            i.in_progress.remove(&batch.key());
                        }
                    }
                } else {
                    break;
                }
            }

            if i.queue.is_empty() {
                if let Some(timer_id) = i.timer_id.take() {
                    ic_cdk_timers::clear_timer(timer_id);
                }
            }
        });

        if !batches.is_empty() {
            let clone = self.clone();
            ic_cdk::futures::spawn(clone.process_all_batches(batches));
        }
    }

    fn set_timer_if_required(&self) -> bool {
        let should_set_timer = self.within_lock(|i| i.timer_id.is_none() && !i.queue.is_empty());
        if should_set_timer {
            let clone = self.clone();
            let timer_id = ic_cdk_timers::set_timer_interval(Duration::ZERO, move || clone.flush());
            self.within_lock(|i| i.timer_id = Some(timer_id));
            true
        } else {
            false
        }
    }

    async fn process_all_batches(self, batches: Vec<T>) {
        futures::future::join_all(batches.into_iter().map(|b| self.process_batch(b))).await;
    }

    async fn process_batch(&self, batch: T) {
        let result = batch.process().await;
        let retry = matches!(result, Err(true));
        let key = batch.key();

        self.within_lock(|i| {
            i.in_progress.remove(&key);
            if retry {
                let queue = i.items_map.entry(key.clone()).or_default();
                for item in batch.into_items() {
                    queue.push_front(item);
                }
            }
            // If there are still any items in the map for this key, re-add it to the queue
            if i.items_map.contains_key(&key) {
                i.queue.push_back(key);
            }
        });
        self.set_timer_if_required();
    }
}

impl<T: TimerJobItemGroup> Clone for GroupedTimerJobQueue<T> {
    fn clone(&self) -> Self {
        Self {
            inner: self.inner.clone(),
            phantom: PhantomData,
        }
    }
}

impl<T: TimerJobItemGroup> Serialize for GroupedTimerJobQueue<T>
where
    <T as TimerJobItemGroup>::CommonArgs: Serialize,
    <T as TimerJobItemGroup>::Key: Serialize,
    <T as TimerJobItemGroup>::Item: Serialize,
{
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        self.within_lock(|i| i.serialize(serializer))
    }
}

impl<'de, T: TimerJobItemGroup + 'static> Deserialize<'de> for GroupedTimerJobQueue<T>
where
    <T as TimerJobItemGroup>::CommonArgs: Deserialize<'de> + Default,
    <T as TimerJobItemGroup>::Key: Deserialize<'de>,
    <T as TimerJobItemGroup>::Item: Deserialize<'de>,
{
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let inner_previous = GroupedTimerJobQueueInnerPrevious::deserialize(deserializer)?;
        let inner = GroupedTimerJobQueueInner {
            args: T::CommonArgs::default(),
            queue: inner_previous.queue,
            items_map: inner_previous.items_map,
            in_progress: inner_previous.in_progress,
            max_concurrency: inner_previous.max_concurrency,
            defer_processing: inner_previous.defer_processing,
            timer_id: None,
        };

        let value = GroupedTimerJobQueue::<T> {
            inner: Rc::new(Mutex::new(inner)),
            phantom: PhantomData,
        };
        value.set_timer_if_required();
        Ok(value)
    }
}

#[derive(Deserialize)]
struct GroupedTimerJobQueueInnerPrevious<K: Clone + Ord, I> {
    queue: VecDeque<K>,
    items_map: BTreeMap<K, VecDeque<I>>,
    in_progress: BTreeSet<K>,
    max_concurrency: usize,
    defer_processing: bool,
}

pub fn deserialize_batched_timer_job_queue_from_previous<'de, D: Deserializer<'de>, T: TimerJobItemBatch + 'static>(
    deserializer: D,
) -> Result<BatchedTimerJobQueue<T>, D::Error>
where
    T::Args: Ord + Deserialize<'de> + From<Principal>,
    T::Item: Deserialize<'de>,
{
    let mut previous: GroupedTimerJobQueueInnerPrevious<T::Args, T::Item> =
        GroupedTimerJobQueueInnerPrevious::deserialize(deserializer)?;

    let mut new = GroupedTimerJobQueueInner {
        args: T::Args::from(Principal::anonymous()),
        queue: VecDeque::new(),
        items_map: BTreeMap::new(),
        in_progress: BTreeSet::new(),
        max_concurrency: 1,
        defer_processing: previous.defer_processing,
        timer_id: None,
    };
    if !previous.queue.is_empty() {
        new.queue.push_back(());
    }
    if let Some((_, items)) = previous.items_map.pop_first() {
        new.items_map.insert((), items);
    }

    let value = GroupedTimerJobQueue {
        inner: Rc::new(Mutex::new(new)),
        phantom: PhantomData,
    };
    value.set_timer_if_required();
    Ok(BatchedTimerJobQueue(value))
}

#[macro_export]
macro_rules! grouped_timer_job_batch {
    ($name:ident, $args_type:ty, $key_type:ty, $item_type:ty, $batch_size:literal) => {
        pub struct $name {
            args: $args_type,
            key: $key_type,
            items: Vec<$item_type>,
        }

        impl timer_job_queues::TimerJobItemGroup for $name {
            type CommonArgs = $args_type;
            type Key = $key_type;
            type Item = $item_type;

            fn new(args: $args_type, key: $key_type) -> Self {
                $name {
                    args,
                    key,
                    items: Vec::new(),
                }
            }

            fn key(&self) -> $key_type {
                self.key
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
