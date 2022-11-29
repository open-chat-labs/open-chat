use crate::mutate_state;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::cmp::Ordering;
use std::collections::BinaryHeap;
use std::time::Duration;
use types::{MessageIndex, TimestampMillis};

thread_local! {
    static JOBS: RefCell<BinaryHeap<JobAndDueDate>> = RefCell::default();
}

pub fn enqueue_job(job: Job, due: TimestampMillis, now: TimestampMillis) {
    JOBS.with(|jobs| jobs.borrow_mut().push(JobAndDueDate::new(job, due)));

    let delay = due.saturating_sub(now);

    ic_cdk::timer::set_timer(Duration::from_millis(delay), execute_next_job);
}

pub fn get_jobs() -> Vec<JobAndDueDate> {
    JOBS.with(|jobs| jobs.borrow().iter().cloned().collect())
}

#[derive(Serialize, Deserialize, Clone)]
pub enum Job {
    EndPoll(EndPollJob),
}

#[derive(Serialize, Deserialize, Clone)]
pub struct EndPollJob {
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
}

fn execute_next_job() {
    mutate_state(|state| {
        let now = state.env.now();
        if let Some(job) = take_next_job(now) {
            match job {
                Job::EndPoll(e) => {
                    state
                        .data
                        .events
                        .end_poll(e.thread_root_message_index, e.message_index, 0, now);
                }
            }
        }
    });
}

fn take_next_job(now: TimestampMillis) -> Option<Job> {
    JOBS.with(|jobs| {
        if jobs.borrow().peek().filter(|j| j.due <= now).is_some() {
            jobs.borrow_mut().pop().map(|j| j.job)
        } else {
            None
        }
    })
}

#[derive(Serialize, Deserialize, Clone)]
pub struct JobAndDueDate {
    job: Job,
    due: TimestampMillis,
}

impl JobAndDueDate {
    fn new(job: Job, due: TimestampMillis) -> JobAndDueDate {
        JobAndDueDate { job, due }
    }
}

impl PartialEq<Self> for JobAndDueDate {
    fn eq(&self, other: &Self) -> bool {
        self.due == other.due
    }
}

impl PartialOrd for JobAndDueDate {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Eq for JobAndDueDate {}

impl Ord for JobAndDueDate {
    fn cmp(&self, other: &Self) -> Ordering {
        self.due.cmp(&other.due).reverse()
    }
}
