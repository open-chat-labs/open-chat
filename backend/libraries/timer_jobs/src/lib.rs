use ic_cdk::timer::TimerId;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::cell::RefCell;
use std::collections::BTreeMap;
use std::ops::Deref;
use std::rc::Rc;
use std::time::Duration;
use types::TimestampMillis;

pub struct TimerJobs<J> {
    jobs: BTreeMap<TimerId, (TimestampMillis, JobWrapper<J>)>,
}

type JobWrapper<J> = Rc<RefCell<Option<J>>>;

impl<J: Job> TimerJobs<J> {
    pub fn enqueue_job(&mut self, job: J, due: TimestampMillis, now: TimestampMillis) {
        let delay = due.saturating_sub(now);
        let wrapper = Rc::new(RefCell::new(Some(job)));
        let clone = wrapper.clone();
        let timer_id = ic_cdk::timer::set_timer(Duration::from_millis(delay), move || {
            if let Some(j) = clone.borrow_mut().take() {
                j.execute();
            }
        });

        self.jobs.insert(timer_id, (due, wrapper));
    }
}

impl<J> TimerJobs<J> {
    #[allow(clippy::redundant_closure)]
    pub fn cancel_jobs<F: Fn(&J) -> bool>(&mut self, filter: F) {
        let to_remove: Vec<_> = self
            .jobs
            .iter()
            .filter(|(_, (_, wrapper))| wrapper.deref().borrow().as_ref().map_or(true, |j| filter(j)))
            .map(|(timer_id, _)| *timer_id)
            .collect();

        for timer_id in to_remove {
            ic_cdk::timer::clear_timer(timer_id);
            self.jobs.remove(&timer_id);
        }
    }
}

pub trait Job: 'static {
    fn execute(&self);
}

#[derive(Serialize, Deserialize)]
pub struct ScheduledJob<Job> {
    pub job: Job,
    pub due: TimestampMillis,
}

impl<J: Clone> From<&TimerJobs<J>> for Vec<(J, TimestampMillis)> {
    fn from(timer_jobs: &TimerJobs<J>) -> Self {
        timer_jobs
            .jobs
            .values()
            .filter_map(|(ts, wrapper)| wrapper.deref().borrow().as_ref().map(|job| (job.clone(), *ts)))
            .collect()
    }
}

impl<J: Job> From<Vec<(J, TimestampMillis)>> for TimerJobs<J> {
    fn from(jobs: Vec<(J, TimestampMillis)>) -> Self {
        let now = utils::time::now_millis();

        let mut timer_jobs = TimerJobs::default();
        for (job, ts) in jobs {
            timer_jobs.enqueue_job(job, ts, now);
        }

        timer_jobs
    }
}

impl<J: Serialize + Clone> Serialize for TimerJobs<J> {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let serializable: Vec<(J, TimestampMillis)> = self.into();

        serializable.serialize(serializer)
    }
}

impl<'de, J: Job + Deserialize<'de>> Deserialize<'de> for TimerJobs<J> {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let vec: Vec<(J, TimestampMillis)> = Vec::deserialize(deserializer)?;

        let now = utils::time::now_millis();

        let mut timer_jobs = TimerJobs::default();
        for (job, due) in vec {
            timer_jobs.enqueue_job(job, due, now);
        }
        Ok(timer_jobs)
    }
}

impl<J> Default for TimerJobs<J> {
    fn default() -> Self {
        TimerJobs {
            jobs: BTreeMap::default(),
        }
    }
}
