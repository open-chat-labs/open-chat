use ic_cdk_timers::TimerId;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::collections::VecDeque;
use std::rc::Rc;
use std::sync::{Mutex, MutexGuard};
use std::time::Duration;

pub trait TimerJobItem {
    fn process(&self) -> impl std::future::Future<Output = Result<(), bool>> + Send;
}

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

    pub fn set_max_concurrency(&mut self, value: usize) {
        let mut inner = self.inner();
        inner.max_concurrency = value;
    }

    pub fn clear(&self) {
        self.inner().queue.clear()
    }

    pub fn len(&self) -> usize {
        self.inner().queue.len()
    }

    pub fn is_empty(&self) -> bool {
        self.inner().queue.is_empty()
    }

    pub fn in_progress(&self) -> usize {
        self.inner().in_progress
    }

    fn inner(&self) -> MutexGuard<TimerJobQueueInner<T>> {
        self.inner.lock().unwrap()
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
    pub fn start_job_if_required(&self) -> bool {
        let mut inner = self.inner();
        if inner.timer_id.is_none() && !inner.queue.is_empty() {
            let clone = self.clone();
            let timer_id = ic_cdk_timers::set_timer_interval(Duration::ZERO, move || clone.run());
            inner.timer_id = Some(timer_id);
            true
        } else {
            false
        }
    }

    pub fn enqueue(&self, item: T) {
        self.inner().queue.push_back(item);
        self.start_job_if_required();
    }

    pub fn enqueue_front(&self, item: T) {
        self.inner().queue.push_front(item);
        self.start_job_if_required();
    }

    pub fn enqueue_many(&self, items: impl Iterator<Item = T>) {
        let mut inner = self.inner();
        for item in items {
            inner.queue.push_back(item);
        }
        self.start_job_if_required();
    }

    fn run(&self) {
        let mut inner = self.inner();
        if inner.queue.is_empty() {
            if let Some(timer_id) = inner.timer_id.take() {
                ic_cdk_timers::clear_timer(timer_id);
            }
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
    }

    async fn process_batch(self, batch: Vec<T>) {
        futures::future::join_all(batch.into_iter().map(|i| self.process_single(i))).await;
    }

    async fn process_single(&self, item: T) {
        if let Err(retry) = item.process().await {
            if retry {
                let mut inner = self.inner();
                inner.queue.push_front(item);
                inner.in_progress = inner.in_progress.saturating_sub(1);
                self.start_job_if_required();
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

impl<'de, T: Deserialize<'de> + TimerJobItem + 'static> Deserialize<'de> for TimerJobQueue<T> {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let inner = TimerJobQueueInner::deserialize(deserializer)?;
        let value = TimerJobQueue {
            inner: Rc::new(Mutex::new(inner)),
        };
        value.start_job_if_required();
        Ok(value)
    }
}
