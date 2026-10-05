use crate::model::pending_payments_queue::PendingPayment;
use crate::mutate_state;
use canister_timer_jobs::Job;
use escrow_canister::SwapStatus;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub enum TimerJob {
    ExpireSwap(Box<ExpireSwapJob>),
    RetryPayment(Box<RetryPaymentJob>),
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ExpireSwapJob {
    pub swap_id: u32,
}

// Retries a payment, after a failed attempt to call into its ledger
#[derive(Serialize, Deserialize, Clone)]
pub struct RetryPaymentJob {
    pub payment: PendingPayment,
    // The number of attempts at the payment which have failed to call into its ledger so far
    pub failures: u32,
}

impl Job for TimerJob {
    fn execute(self) {
        match self {
            TimerJob::ExpireSwap(job) => job.execute(),
            TimerJob::RetryPayment(job) => job.execute(),
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

impl Job for RetryPaymentJob {
    fn execute(self) {
        crate::jobs::make_pending_payments::retry(self.payment, self.failures);
    }
}
