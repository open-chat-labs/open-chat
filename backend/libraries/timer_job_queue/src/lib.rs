use ic_cdk::api::call::CallResult;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::collections::VecDeque;
use std::rc::Rc;
use std::sync::Mutex;

pub trait TimerJobItem: Clone {
    fn process(&self) -> impl std::future::Future<Output = CallResult<()>> + Send;
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

    pub fn set_max_concurrency(&mut self, value: usize) {
        let mut inner = self.inner.lock().unwrap();
        inner.max_concurrency = value;
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
    pub fn run(&self) -> bool {
        let mut inner = self.inner.lock().unwrap();
        if inner.queue.is_empty() && inner.in_progress == 0 {
            return true;
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
        inner.in_progress = inner.in_progress.saturating_add(items.len());

        if !items.is_empty() {
            let clone = self.clone();
            ic_cdk::spawn(clone.process_batch(items));
        }

        false
    }

    pub fn enqueue(&mut self, item: T) {
        self.inner.lock().unwrap().queue.push_back(item);
    }

    pub fn enqueue_front(&mut self, item: T) {
        self.inner.lock().unwrap().queue.push_front(item);
    }

    pub fn enqueue_many(&mut self, items: impl Iterator<Item = T>) {
        let mut inner = self.inner.lock().unwrap();
        for item in items {
            inner.queue.push_back(item);
        }
    }

    pub fn len(&self) -> usize {
        self.inner.lock().unwrap().queue.len()
    }

    pub fn is_empty(&self) -> bool {
        self.inner.lock().unwrap().queue.is_empty()
    }

    async fn process_batch(self, batch: Vec<T>) {
        futures::future::join_all(batch.into_iter().map(|i| self.process_single(i))).await;
    }

    async fn process_single(&self, item: T) {
        if item.process().await.is_err() {
            let mut inner = self.inner.lock().unwrap();
            inner.queue.push_front(item);
            inner.in_progress = inner.in_progress.saturating_sub(1);
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
