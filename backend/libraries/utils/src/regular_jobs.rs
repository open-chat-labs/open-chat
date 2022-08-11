use crate::env::Environment;
use tracing::trace;
use types::{Milliseconds, TimestampMillis};

#[derive(Default)]
pub struct RegularJobs<Data> {
    jobs: Vec<RegularJob<Data>>,
}

impl<Data> RegularJobs<Data> {
    pub fn new(jobs: Vec<RegularJob<Data>>) -> RegularJobs<Data> {
        RegularJobs { jobs }
    }

    pub fn run(&mut self, env: &dyn Environment, data: &mut Data) -> Vec<&'static str> {
        let mut jobs_run = Vec::new();
        for job in self.jobs.iter_mut() {
            if job.run_if_due(env, data) {
                trace!(job.name, "Regular job executed");
                jobs_run.push(job.name);
            }
        }
        jobs_run
    }
}

pub struct RegularJob<Data> {
    name: &'static str,
    action: fn(&dyn Environment, &mut Data),
    min_interval: Milliseconds,
    last_run: TimestampMillis,
}

impl<Data> RegularJob<Data> {
    pub fn new(name: &'static str, action: fn(&dyn Environment, &mut Data), min_interval: Milliseconds) -> RegularJob<Data> {
        RegularJob {
            name,
            action,
            min_interval,
            last_run: 0,
        }
    }

    pub fn run_if_due(&mut self, env: &dyn Environment, data: &mut Data) -> bool {
        let now = env.now();
        if now > self.next_due() {
            self.last_run = now;
            (self.action)(env, data);
            true
        } else {
            false
        }
    }

    fn next_due(&self) -> TimestampMillis {
        self.last_run + self.min_interval
    }
}
