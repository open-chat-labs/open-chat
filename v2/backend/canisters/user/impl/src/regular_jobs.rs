use crate::{RuntimeState, RUNTIME_STATE};
use candid::CandidType;
use serde::Deserialize;
use types::{CanisterId, Cycles, Milliseconds, RegularJobStatus};

const ONE_MINUTE_MS: Milliseconds = 60 * 1000;

#[derive(CandidType, Deserialize)]
pub struct RegularJobStatuses {
    check_cycles_balance: RegularJobStatus,
}

impl RegularJobStatuses {
    pub fn new() -> RegularJobStatuses {
        RegularJobStatuses {
            check_cycles_balance: RegularJobStatus::new(ONE_MINUTE_MS),
        }
    }
}

impl Default for RegularJobStatuses {
    fn default() -> Self {
        RegularJobStatuses::new()
    }
}

enum RegularJob {
    // Contains the user's cycles balance + the user index canister Id
    CheckCyclesBalance(Cycles, CanisterId),
}

pub fn run() {
    if let Some(job) = RUNTIME_STATE.with(|state| try_start_next_job(state.borrow_mut().as_mut().unwrap())) {
        match job {
            RegularJob::CheckCyclesBalance(user_cycles_balance, group_index_canister_id) => {
                cycles_utils::check_cycles_balance(user_cycles_balance, group_index_canister_id);
            }
        }
    }
}

fn try_start_next_job(runtime_state: &mut RuntimeState) -> Option<RegularJob> {
    let now = runtime_state.env.now();
    let job_statuses = &mut runtime_state.data.regular_job_statuses;

    if job_statuses.check_cycles_balance.try_start(now) {
        Some(RegularJob::CheckCyclesBalance(
            runtime_state.data.user_cycles_balance.value,
            runtime_state.data.group_index_canister_id,
        ))
    } else {
        None
    }
}
