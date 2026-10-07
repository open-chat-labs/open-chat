use crate::model::pending_payments_queue::PendingPayment;
use crate::mutate_state;
use canister_timer_jobs::Job;
use escrow_canister::SwapStatus;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub enum TimerJob {
    ExpireSwap(Box<ExpireSwapJob>),
    NotifyStatusChange(Box<NotifyStatusChangeJob>),
    RetryPayment(Box<RetryPaymentJob>),
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ExpireSwapJob {
    pub swap_id: u32,
}

// Retries notifying the swap's `canister_to_notify` of its status, after a failed attempt
#[derive(Serialize, Deserialize, Clone)]
pub struct NotifyStatusChangeJob {
    pub swap_id: u32,
    // The number of attempts at the notification which have failed so far
    pub failures: u32,
}

// Retries a payment, after a failed attempt at it
#[derive(Serialize, Deserialize, Clone)]
pub struct RetryPaymentJob {
    pub payment: PendingPayment,
    // The number of attempts at the payment which have failed so far
    pub failures: u32,
    // Whether any of those attempts may have made the transfer nonetheless, its outcome being unknown
    #[serde(default)]
    pub outcome_unknown: bool,
}

impl Job for TimerJob {
    fn execute(self) {
        match self {
            TimerJob::ExpireSwap(job) => job.execute(),
            TimerJob::NotifyStatusChange(job) => job.execute(),
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

impl Job for NotifyStatusChangeJob {
    fn execute(self) {
        crate::jobs::notify_status_change::retry(self.swap_id, self.failures);
    }
}

impl Job for RetryPaymentJob {
    fn execute(self) {
        crate::jobs::make_pending_payments::retry(self.payment, self.failures, self.outcome_unknown);
    }
}
