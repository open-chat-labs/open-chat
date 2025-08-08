use crate::mutate_state;
use canister_timer_jobs::Job;
use escrow_canister::SwapStatus;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub enum TimerJob {
    ExpireSwap(Box<ExpireSwapJob>),
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ExpireSwapJob {
    pub swap_id: u32,
}

impl Job for TimerJob {
    fn execute(self) {
        match self {
            TimerJob::ExpireSwap(job) => job.execute(),
        }
    }
}

impl Job for ExpireSwapJob {
    fn execute(self) {
        mutate_state(|state| {
            if let Some(swap) = state.data.swaps.get(self.swap_id)
                && matches!(swap.status(state.env.now()), SwapStatus::Expired(_))
            {
                state.data.pending_payments_queue.push_refunds(swap, state.env.now());
                crate::jobs::make_pending_payments::start_job_if_required(state);
            }
        });
    }
}
