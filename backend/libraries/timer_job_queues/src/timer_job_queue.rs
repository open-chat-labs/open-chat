use crate::TimerJobItem;
use ic_cdk_timers::TimerId;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::collections::VecDeque;
use std::ops::DerefMut;
use std::rc::Rc;
use std::sync::Mutex;
use std::time::Duration;

pub struct TimerJobQueue<T> {
    inner: Rc<Mutex<TimerJobQueueInner<T>>>,
}

impl<T> TimerJobQueue<T> {
    pub fn new(max_concurrency: usize) -> Self {
        Self {
            inner: Rc::new(Mutex::new(TimerJobQueueInner {
                queue: VecDeque::new(),
                in_progress: 0,
                max_concurrency,
                timer_id: None,
            })),
        }
    }

    pub fn set_max_concurrency(&self, value: usize) {
        self.within_lock(|i| i.max_concurrency = value)
    }

    pub fn clear(&self) {
        self.within_lock(|i| i.queue.clear())
    }

    pub fn len(&self) -> usize {
        self.within_lock(|i| i.queue.len())
    }

    pub fn is_empty(&self) -> bool {
        self.within_lock(|i| i.queue.is_empty())
    }

    pub fn in_progress(&self) -> usize {
        self.within_lock(|i| i.in_progress)
    }

    fn within_lock<F: FnOnce(&mut TimerJobQueueInner<T>) -> R, R>(&self, f: F) -> R {
        let mut inner = self.inner.try_lock().unwrap();
        f(inner.deref_mut())
    }
}

#[derive(Serialize, Deserialize)]
struct TimerJobQueueInner<T> {
    queue: VecDeque<T>,
    in_progress: usize,
    max_concurrency: usize,
    #[serde(skip)]
    timer_id: Option<TimerId>,
}

impl<T> TimerJobQueue<T>
where
    T: TimerJobItem + 'static,
{
    pub fn enqueue(&self, item: T) {
        self.within_lock(|i| i.queue.push_back(item));
        self.set_timer_if_required();
    }

    pub fn enqueue_front(&self, item: T) {
        self.within_lock(|i| i.queue.push_front(item));
        self.set_timer_if_required();
    }

    pub fn enqueue_many(&self, items: impl Iterator<Item = T>) {
        self.within_lock(|i| {
            for item in items {
                i.queue.push_back(item);
            }
        });
        self.set_timer_if_required();
    }

    fn set_timer_if_required(&self) -> bool {
        let should_set_timer = self.within_lock(|i| i.timer_id.is_none() && !i.queue.is_empty());
        if should_set_timer {
            let clone = self.clone();
            let timer_id = ic_cdk_timers::set_timer_interval(Duration::ZERO, move || clone.run());
            self.within_lock(|i| i.timer_id = Some(timer_id));
            true
        } else {
            false
        }
    }

    fn run(&self) {
        let mut items = Vec::new();

        self.within_lock(|i| {
            let max_to_start = i.max_concurrency.saturating_sub(i.in_progress);
            while items.len() < max_to_start {
                if let Some(item) = i.queue.pop_front() {
                    items.push(item);
                } else {
                    break;
                }
            }
            let count = items.len();
            i.in_progress = i.in_progress.saturating_add(count);

            if i.queue.is_empty() {
                if let Some(timer_id) = i.timer_id.take() {
                    ic_cdk_timers::clear_timer(timer_id);
                }
            }
        });

        if !items.is_empty() {
            let clone = self.clone();
            ic_cdk::spawn(clone.process_batch(items));
        }
    }

    async fn process_batch(self, batch: Vec<T>) {
        futures::future::join_all(batch.into_iter().map(|i| self.process_single(i))).await;
    }

    async fn process_single(&self, item: T) {
        let result = item.process().await;
        let retry = matches!(result, Err(true));

        self.within_lock(|i| {
            if retry {
                i.queue.push_front(item);
            }
            i.in_progress = i.in_progress.saturating_sub(1);
        });
        self.set_timer_if_required();
    }
}

impl<T> Clone for TimerJobQueue<T> {
    fn clone(&self) -> Self {
        Self {
            inner: self.inner.clone(),
        }
    }
}

impl<T: Serialize> Serialize for TimerJobQueue<T> {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        self.within_lock(|i| i.serialize(serializer))
    }
}

impl<'de, T: Deserialize<'de> + TimerJobItem + 'static> Deserialize<'de> for TimerJobQueue<T> {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let inner = TimerJobQueueInner::deserialize(deserializer)?;
        let value = TimerJobQueue {
            inner: Rc::new(Mutex::new(inner)),
        };
        value.set_timer_if_required();
        Ok(value)
    }
}
