use candid::CandidType;
use serde::Deserialize;
use types::{Cycles, TimestampMillis, Timestamped};

#[derive(CandidType, Deserialize)]
pub struct UserCyclesBalance {
    cycles: Timestamped<Cycles>,
}

impl UserCyclesBalance {
    pub fn new(now: TimestampMillis) -> UserCyclesBalance {
        UserCyclesBalance {
            cycles: Timestamped::new(0, now)
        }
    }

    pub fn value(&self) -> Cycles {
        self.cycles.value
    }

    pub fn last_updated(&self) -> TimestampMillis {
        self.cycles.timestamp
    }

    pub fn add(&mut self, cycles: Cycles, now: TimestampMillis) {
        let new_cycles_balance = self.cycles.value + cycles;
        self.cycles = Timestamped::new(new_cycles_balance, now);
    }

    pub fn try_subtract(&mut self, cycles: Cycles, now: TimestampMillis) -> bool {
        if let Some(new_user_balance) = self.cycles.value.checked_sub(cycles) {
            self.cycles = Timestamped::new(new_user_balance, now);
            true
        } else {
            false
        }
    }
}
