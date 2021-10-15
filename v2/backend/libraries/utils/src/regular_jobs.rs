use types::{Milliseconds, TimestampMillis};

#[derive(Default)]
pub struct RegularJobs<Data> {
    jobs: Vec<RegularJob<Data>>,
}

impl<Data> RegularJobs<Data> {
    pub fn new(jobs: Vec<RegularJob<Data>>) -> RegularJobs<Data> {
        RegularJobs { jobs }
    }

    pub fn try_run_next(&mut self, now: TimestampMillis, data: &mut Data) -> Option<String> {
        for job in self.jobs.iter_mut() {
            if job.try_run(now, data) {
                return Some(job.name.clone());
            }
        }
        None
    }
}

pub struct RegularJob<Data> {
    name: String,
    action: fn(&mut Data),
    interval: Milliseconds,
    last_run: TimestampMillis,
}

impl<Data> RegularJob<Data> {
    pub fn new(name: String, action: fn(&mut Data), interval: Milliseconds) -> RegularJob<Data> {
        RegularJob {
            name,
            action,
            interval,
            last_run: 0,
        }
    }

    pub fn try_run(&mut self, now: TimestampMillis, data: &mut Data) -> bool {
        if now > self.next_due() {
            self.last_run = now;
            (self.action)(data);
            true
        } else {
            false
        }
    }

    fn next_due(&self) -> TimestampMillis {
        self.last_run + self.interval
    }
}
