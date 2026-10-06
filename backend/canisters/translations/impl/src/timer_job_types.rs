use crate::model::pending_payments_queue::PendingPayment;
use canister_timer_jobs::Job;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub enum TimerJob {
    RetryPayment(Box<RetryPaymentJob>),
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
            TimerJob::RetryPayment(job) => job.execute(),
        }
    }
}

impl Job for RetryPaymentJob {
    fn execute(self) {
        crate::jobs::make_pending_payments::retry(self.payment, self.failures);
    }
}
