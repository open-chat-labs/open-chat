use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::collections::VecDeque;
use std::rc::Rc;
use std::sync::{Mutex, MutexGuard};

pub trait TimerJobItem: Clone {
    fn process(&self) -> impl std::future::Future<Output = Result<(), bool>> + Send;
}

pub struct TimerJobQueue<T> {
    inner: Rc<Mutex<TimerJobProcessorInner<T>>>,
}

impl<T> TimerJobQueue<T> {
    pub fn new(max_concurrency: usize) -> Self {
        Self {
            inner: Rc::new(Mutex::new(TimerJobProcessorInner {
                queue: VecDeque::new(),
                in_progress: 0,
                max_concurrency,
            })),
        }
    }

    pub fn enqueue(&self, item: T) {
        self.unlock().queue.push_back(item);
    }

    pub fn enqueue_front(&self, item: T) {
        self.unlock().queue.push_front(item);
    }

    pub fn enqueue_many(&self, items: impl Iterator<Item = T>) {
        let mut inner = self.unlock();
        for item in items {
            inner.queue.push_back(item);
        }
    }

    pub fn set_max_concurrency(&mut self, value: usize) {
        let mut inner = self.inner.lock().unwrap();
        inner.max_concurrency = value;
    }

    pub fn clear(&self) {
        self.unlock().queue.clear()
    }

    pub fn len(&self) -> usize {
        self.inner.lock().unwrap().queue.len()
    }

    pub fn is_empty(&self) -> bool {
        self.unlock().queue.is_empty()
    }

    pub fn in_progress(&self) -> usize {
        self.unlock().in_progress
    }

    fn unlock(&self) -> MutexGuard<TimerJobProcessorInner<T>> {
        self.inner.lock().unwrap()
    }
}

#[derive(Serialize, Deserialize)]
struct TimerJobProcessorInner<T> {
    queue: VecDeque<T>,
    in_progress: usize,
    max_concurrency: usize,
}

impl<T> TimerJobQueue<T>
where
    T: TimerJobItem + 'static,
{
    pub fn run(&self) -> Option<usize> {
        let mut inner = self.unlock();
        if inner.queue.is_empty() && inner.in_progress == 0 {
            return None;
        }

        let max_to_start = inner.max_concurrency.saturating_sub(inner.in_progress);
        let mut items = Vec::new();
        while items.len() < max_to_start {
            if let Some(item) = inner.queue.pop_front() {
                items.push(item);
            } else {
                break;
            }
        }
        let count = items.len();
        inner.in_progress = inner.in_progress.saturating_add(count);

        if !items.is_empty() {
            let clone = self.clone();
            ic_cdk::spawn(clone.process_batch(items));
        }

        Some(count)
    }

    async fn process_batch(self, batch: Vec<T>) {
        futures::future::join_all(batch.into_iter().map(|i| self.process_single(i))).await;
    }

    async fn process_single(&self, item: T) {
        if let Err(retry) = item.process().await {
            if retry {
                let mut inner = self.unlock();
                inner.queue.push_front(item);
                inner.in_progress = inner.in_progress.saturating_sub(1);
            }
        }
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
        let inner = self.inner.lock().unwrap();
        inner.serialize(serializer)
    }
}

impl<'de, T: Deserialize<'de>> Deserialize<'de> for TimerJobQueue<T> {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let inner = TimerJobProcessorInner::deserialize(deserializer)?;
        Ok(TimerJobQueue {
            inner: Rc::new(Mutex::new(inner)),
        })
    }
}
