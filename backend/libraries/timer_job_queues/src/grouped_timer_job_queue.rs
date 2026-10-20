use crate::TimerJobItemGroup;
use per_round_timer::PerRoundTimer;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::collections::btree_map::Entry::{Occupied, Vacant};
use std::collections::{BTreeMap, BTreeSet, VecDeque};
use std::marker::PhantomData;
use std::ops::DerefMut;
use std::rc::Rc;
use std::sync::Mutex;
use std::time::Duration;
use types::Milliseconds;

// Use this to process events where events are grouped into batches based on their key.
// Eg. sending events to users' canisters (in this case the canister id would be the key).
#[expect(clippy::type_complexity)]
pub struct GroupedTimerJobQueue<T: TimerJobItemGroup> {
    inner: Rc<Mutex<GroupedTimerJobQueueInner<T::SharedState, T::Key, T::Item>>>,
    phantom: PhantomData<T>,
}

impl<T: TimerJobItemGroup> GroupedTimerJobQueue<T>
where
    T::SharedState: Default,
{
    pub fn new(max_concurrency: usize, defer_processing: bool) -> Self {
        Self::new_with_state(T::SharedState::default(), max_concurrency, defer_processing)
    }
}

impl<T: TimerJobItemGroup> GroupedTimerJobQueue<T> {
    pub fn new_with_state(state: T::SharedState, max_concurrency: usize, defer_processing: bool) -> Self {
        Self {
            inner: Rc::new(Mutex::new(GroupedTimerJobQueueInner {
                state,
                queue: VecDeque::new(),
                items_map: BTreeMap::new(),
                in_progress: BTreeSet::new(),
                max_concurrency,
                defer_processing,
                timer: None,
            })),
            phantom: PhantomData,
        }
    }

    pub fn set_shared_state(&mut self, state: T::SharedState) {
        self.within_lock(|i| i.state = state);
    }

    pub fn max_concurrency(&self) -> usize {
        self.within_lock(|i| i.max_concurrency)
    }

    pub fn set_max_concurrency(&mut self, value: usize) {
        self.within_lock(|i| i.max_concurrency = value)
    }

    pub fn defer_processing(&self) -> bool {
        self.within_lock(|i| i.defer_processing)
    }

    pub fn set_defer_processing(&mut self, value: bool) {
        self.within_lock(|i| i.defer_processing = value)
    }

    // Removes every queued item. Items in a batch which is already being processed are unaffected.
    pub fn clear(&mut self) {
        self.within_lock(|i| {
            i.queue.clear();
            i.items_map.clear();
        })
    }

    pub fn len(&self) -> usize {
        self.within_lock(|i| i.items_map.values().map(|v| v.len()).sum())
    }

    // Removes and returns every queued item, grouped by key. Items in a batch which is already
    // being processed are unaffected.
    pub fn take_all(&mut self) -> Vec<(T::Key, Vec<T::Item>)> {
        self.within_lock(|i| {
            i.queue.clear();
            std::mem::take(&mut i.items_map)
                .into_iter()
                .map(|(key, items)| (key, items.into()))
                .collect()
        })
    }

    // Removes and returns the items queued for `grouping_key`, in order. Items in a batch which is
    // already being processed are unaffected.
    pub fn take(&mut self, grouping_key: &T::Key) -> Vec<T::Item> {
        self.within_lock(|i| {
            let items = i.items_map.remove(grouping_key).map(Vec::from).unwrap_or_default();
            if !items.is_empty() {
                i.queue.retain(|key| key != grouping_key);
            }
            items
        })
    }

    // Removes the queued items for which `f` returns false. Items in a batch which is already
    // being processed are unaffected.
    pub fn retain(&mut self, f: impl Fn(&T::Item) -> bool) {
        self.within_lock(|i| {
            i.items_map.retain(|_, items| {
                items.retain(|item| f(item));
                !items.is_empty()
            });
            let items_map = &i.items_map;
            i.queue.retain(|key| items_map.contains_key(key));
        })
    }

    // Whether no items are queued, including those of keys waiting to be retried
    pub fn is_empty(&self) -> bool {
        self.within_lock(|i| i.items_map.is_empty())
    }

    pub fn in_progress(&self) -> usize {
        self.within_lock(|i| i.in_progress.len())
    }

    // Whether a batch for `grouping_key` is being processed
    pub fn is_in_progress(&self, grouping_key: &T::Key) -> bool {
        self.within_lock(|i| i.in_progress.contains(grouping_key))
    }

    fn within_lock<F: FnOnce(&mut GroupedTimerJobQueueInner<T::SharedState, T::Key, T::Item>) -> R, R>(&self, f: F) -> R {
        let mut inner = self.inner.try_lock().unwrap();
        f(inner.deref_mut())
    }
}

#[derive(Serialize, Deserialize)]
struct GroupedTimerJobQueueInner<S: Clone, K: Clone + Ord, I> {
    state: S,
    // The keys whose items are ready to be processed. A key which failed and is to be retried after
    // a delay is left out until the delay has passed, though its items stay in `items_map`.
    queue: VecDeque<K>,
    items_map: BTreeMap<K, VecDeque<I>>,
    in_progress: BTreeSet<K>,
    max_concurrency: usize,
    defer_processing: bool,
    #[serde(skip)]
    timer: Option<PerRoundTimer>,
}

impl<S: Clone, K: Clone + Ord, I> GroupedTimerJobQueueInner<S, K, I> {
    // Records that the batch for `key` has finished, putting `failed_items` back at the front of its
    // items if it is to be retried. The key is re-added to the queue if it still has items, unless it
    // is to be retried after a delay, which it must wait out first: otherwise the next push for any
    // key would retry it at once. Returns whether it is waiting.
    fn finish_batch(&mut self, key: &K, failed_items: Option<Vec<I>>, retry_delay: Option<Milliseconds>) -> bool {
        self.in_progress.remove(key);
        if let Some(items) = failed_items {
            let queue = self.items_map.entry(key.clone()).or_default();
            // Prepend the items to the front of the queue such that ordering is maintained
            for item in items.into_iter().rev() {
                queue.push_front(item);
            }
        }
        if !self.items_map.contains_key(key) {
            return false;
        }
        if retry_delay.is_some_and(|delay| delay > 0) {
            true
        } else {
            self.queue.push_back(key.clone());
            false
        }
    }

    // Re-adds a key which has waited out its retry delay, if it still has items and isn't already
    // queued or being processed
    fn end_wait(&mut self, key: K) {
        if self.items_map.contains_key(&key) && !self.in_progress.contains(&key) && !self.queue.contains(&key) {
            self.queue.push_back(key);
        }
    }

    // Re-adds the keys which were waiting out a retry delay, since their timers don't survive an
    // upgrade
    fn end_all_waits(&mut self) {
        let waiting: Vec<_> = self
            .items_map
            .keys()
            .filter(|key| !self.in_progress.contains(*key) && !self.queue.contains(*key))
            .cloned()
            .collect();
        self.queue.extend(waiting);
    }
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
            self.set_timer_if_required(0);
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

                        let mut batch = T::new(i.state.clone(), grouping_key);
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
                i.timer = None;
            }
        });

        if !batches.is_empty() {
            let clone = self.clone();
            ic_cdk::futures::spawn_migratory(clone.process_all_batches(batches));
        }
    }

    fn set_timer_if_required(&self, delay: Milliseconds) -> bool {
        let clone = self.clone();
        self.within_lock(|i| {
            if !i.queue.is_empty() && i.timer.is_none() {
                i.timer = Some(PerRoundTimer::new_with_interval(Duration::from_millis(delay), move || {
                    clone.flush()
                }));
                true
            } else {
                false
            }
        })
    }

    async fn process_all_batches(self, batches: Vec<T>) {
        futures::future::join_all(batches.into_iter().map(|b| self.process_batch(b))).await;
    }

    async fn process_batch(&self, batch: T) {
        let result = batch.process().await;
        let retry_delay = result.err().flatten();
        let key = batch.key();
        let failed_items = retry_delay.map(|_| batch.into_items());

        let waiting = self.within_lock(|i| i.finish_batch(&key, failed_items, retry_delay));
        if waiting {
            self.end_wait_after(key, retry_delay.unwrap_or_default());
        }
        self.set_timer_if_required(0);
    }

    fn end_wait_after(&self, key: T::Key, delay: Milliseconds) {
        let clone = self.clone();
        ic_cdk_timers::set_timer(Duration::from_millis(delay), async move {
            clone.within_lock(|i| i.end_wait(key));
            clone.set_timer_if_required(0);
        });
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
    <T as TimerJobItemGroup>::SharedState: Serialize,
    <T as TimerJobItemGroup>::Key: Serialize,
    <T as TimerJobItemGroup>::Item: Serialize,
{
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        self.within_lock(|i| i.serialize(serializer))
    }
}

impl<'de, T: TimerJobItemGroup + 'static> Deserialize<'de> for GroupedTimerJobQueue<T>
where
    <T as TimerJobItemGroup>::SharedState: Deserialize<'de>,
    <T as TimerJobItemGroup>::Key: Deserialize<'de>,
    <T as TimerJobItemGroup>::Item: Deserialize<'de>,
{
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let mut inner = GroupedTimerJobQueueInner::deserialize(deserializer)?;
        inner.end_all_waits();
        let value = GroupedTimerJobQueue::<T> {
            inner: Rc::new(Mutex::new(inner)),
            phantom: PhantomData,
        };
        value.set_timer_if_required(0);
        Ok(value)
    }
}

#[macro_export]
macro_rules! grouped_timer_job_batch {
    ($name:ident, $key_type:ty, $item_type:ty, $batch_size:literal) => {
        grouped_timer_job_batch!($name, (), $key_type, $item_type, $batch_size);
    };
    ($name:ident, $state_type:ty, $key_type:ty, $item_type:ty, $batch_size:literal) => {
        pub struct $name {
            state: $state_type,
            key: $key_type,
            items: Vec<$item_type>,
        }

        impl timer_job_queues::TimerJobItemGroup for $name {
            type SharedState = $state_type;
            type Key = $key_type;
            type Item = $item_type;

            fn new(state: $state_type, key: $key_type) -> Self {
                $name {
                    state,
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

#[cfg(test)]
mod tests {
    use super::*;

    const KEY: u32 = 1;
    const OTHER_KEY: u32 = 2;

    // A queue whose batch for `KEY` is being processed, with `queued` pushed for it since
    fn queue_with_batch_in_progress(queued: Vec<u32>) -> GroupedTimerJobQueueInner<(), u32, u32> {
        let mut items_map = BTreeMap::new();
        if !queued.is_empty() {
            items_map.insert(KEY, VecDeque::from(queued));
        }
        GroupedTimerJobQueueInner {
            state: (),
            queue: VecDeque::new(),
            items_map,
            in_progress: BTreeSet::from([KEY]),
            max_concurrency: 10,
            defer_processing: false,
            timer: None,
        }
    }

    fn items(inner: &GroupedTimerJobQueueInner<(), u32, u32>, key: u32) -> Vec<u32> {
        inner
            .items_map
            .get(&key)
            .map(|items| items.iter().copied().collect())
            .unwrap_or_default()
    }

    #[test]
    fn a_batch_retried_after_a_delay_waits_out_the_delay() {
        let mut inner = queue_with_batch_in_progress(vec![3]);

        assert!(inner.finish_batch(&KEY, Some(vec![1, 2]), Some(300_000)));

        // Its items are kept, in order, but it isn't ready to be processed
        assert_eq!(items(&inner, KEY), vec![1, 2, 3]);
        assert!(inner.queue.is_empty());
        assert!(inner.in_progress.is_empty());

        // Nor does another key being queued make it ready
        inner.items_map.insert(OTHER_KEY, VecDeque::from([10]));
        inner.queue.push_back(OTHER_KEY);
        assert_eq!(inner.queue, VecDeque::from([OTHER_KEY]));

        // Once the delay has passed it is ready again, just the once
        inner.end_wait(KEY);
        inner.end_wait(KEY);
        assert_eq!(inner.queue, VecDeque::from([OTHER_KEY, KEY]));
    }

    #[test]
    fn a_batch_retried_immediately_is_ready_at_once() {
        let mut inner = queue_with_batch_in_progress(Vec::new());

        assert!(!inner.finish_batch(&KEY, Some(vec![1, 2]), Some(0)));

        assert_eq!(items(&inner, KEY), vec![1, 2]);
        assert_eq!(inner.queue, VecDeque::from([KEY]));
    }

    #[test]
    fn after_a_batch_succeeds_the_key_is_ready_only_if_items_were_queued_since() {
        let mut inner = queue_with_batch_in_progress(vec![3]);
        assert!(!inner.finish_batch(&KEY, None, None));
        assert_eq!(inner.queue, VecDeque::from([KEY]));

        let mut inner = queue_with_batch_in_progress(Vec::new());
        assert!(!inner.finish_batch(&KEY, None, None));
        assert!(inner.queue.is_empty());
        assert!(inner.items_map.is_empty());
    }

    #[test]
    fn a_waiting_key_is_not_re_added_if_its_items_have_gone_or_it_is_in_progress() {
        let mut inner = queue_with_batch_in_progress(Vec::new());
        inner.finish_batch(&KEY, Some(vec![1]), Some(300_000));

        // Its items were taken while it waited
        inner.items_map.remove(&KEY);
        inner.end_wait(KEY);
        assert!(inner.queue.is_empty());

        // It was queued and taken for processing again while it waited
        inner.items_map.insert(KEY, VecDeque::from([2]));
        inner.in_progress.insert(KEY);
        inner.end_wait(KEY);
        assert!(inner.queue.is_empty());
    }

    #[test]
    fn waiting_keys_are_ready_again_after_an_upgrade() {
        let mut inner = queue_with_batch_in_progress(Vec::new());
        inner.finish_batch(&KEY, Some(vec![1]), Some(300_000));
        inner.items_map.insert(OTHER_KEY, VecDeque::from([10]));
        inner.queue.push_back(OTHER_KEY);

        inner.end_all_waits();

        assert_eq!(inner.queue, VecDeque::from([OTHER_KEY, KEY]));
    }
}
