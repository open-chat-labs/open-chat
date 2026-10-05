use crate::model::notify_status_change_queue::NotifyStatusChangeQueue;
use crate::model::pending_payments_queue::{PendingPayment, PendingPaymentReason, PendingPaymentsQueue};
use crate::model::swaps::Swaps;
use crate::timer_job_types::TimerJob;
use candid::Principal;
use canister_state_macros::canister_state;
use canister_timer_jobs::TimerJobs;
use icrc_ledger_types::icrc1::account::Account;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::{BTreeMap, BTreeSet};
use std::ops::Deref;
use types::{BuildVersion, CanisterId, Cycles, TimestampMillis, Timestamped};
use utils::env::Environment;

mod guards;
mod jobs;
mod lifecycle;
mod memory;
mod model;
mod queries;
mod timer_job_types;
mod updates;

thread_local! {
    static WASM_VERSION: RefCell<Timestamped<BuildVersion>> = RefCell::default();
}

canister_state!(RuntimeState);

struct RuntimeState {
    pub env: Box<dyn Environment>,
    pub data: Data,
}

impl RuntimeState {
    pub fn new(env: Box<dyn Environment>, data: Data) -> RuntimeState {
        RuntimeState { env, data }
    }

    pub fn is_caller_registry_canister(&self) -> bool {
        self.env.caller() == self.data.registry_canister_id
    }

    pub fn metrics(&self) -> Metrics {
        let now = self.env.now();

        Metrics {
            heap_memory_used: utils::memory::heap(),
            stable_memory_used: utils::memory::stable(),
            now,
            cycles_balance: self.env.cycles_balance(),
            liquid_cycles_balance: self.env.liquid_cycles_balance(),
            wasm_version: WASM_VERSION.with_borrow(|v| **v),
            git_commit_id: git_commit_id::git_commit_id().to_string(),
            swaps: self.data.swaps.metrics(now),
            notify_status_change_queue_len: self.data.notify_status_change_queue.len() as u32,
            payments_awaiting_retry: self
                .data
                .timer_jobs
                .iter()
                // A job which has already run leaves an empty entry behind
                .filter(|(_, wrapper)| matches!(wrapper.deref().borrow().as_ref(), Some(TimerJob::RetryPayment(_))))
                .count() as u32,
            parked_payments: self.data.pending_payments_queue.parked_len() as u32,
            stable_memory_sizes: memory::memory_sizes(),
            disabled_tokens: self.data.disabled_tokens.iter().copied().collect(),
            canister_ids: CanisterIds {
                registry: self.data.registry_canister_id,
                cycles_dispenser: self.data.cycles_dispenser_canister_id,
            },
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub swaps: Swaps,
    pub pending_payments_queue: PendingPaymentsQueue,
    pub notify_status_change_queue: NotifyStatusChangeQueue,
    timer_jobs: TimerJobs<TimerJob>,
    pub registry_canister_id: CanisterId,
    pub cycles_dispenser_canister_id: CanisterId,
    pub disabled_tokens: BTreeSet<CanisterId>,
    pub rng_seed: [u8; 32],
    pub test_mode: bool,
}

impl Data {
    pub fn new(registry_canister_id: CanisterId, cycles_dispenser_canister_id: CanisterId, test_mode: bool) -> Data {
        Data {
            swaps: Swaps::default(),
            pending_payments_queue: PendingPaymentsQueue::default(),
            notify_status_change_queue: NotifyStatusChangeQueue::default(),
            timer_jobs: TimerJobs::default(),
            registry_canister_id,
            cycles_dispenser_canister_id,
            disabled_tokens: BTreeSet::new(),
            rng_seed: [0; 32],
            test_mode,
        }
    }

    // Counts the refunds which are queued, parked or awaiting retry against their deposits, so that
    // those queued before refunds were counted aren't missed. Each deposit's outstanding refunds are
    // counted afresh, so this is safe to run more than once.
    // TODO remove after the release containing this has been deployed, along with `Swaps::iter_mut` and
    // `PendingPaymentsQueue::iter`
    pub fn count_outstanding_refunds(&mut self) {
        let awaiting_retry: Vec<PendingPayment> = self
            .timer_jobs
            .iter()
            .filter_map(|(_, wrapper)| match wrapper.deref().borrow().as_ref() {
                Some(TimerJob::RetryPayment(job)) => Some(job.payment.clone()),
                _ => None,
            })
            .collect();

        for swap in self.swaps.iter_mut() {
            for refunds in swap.deposit_refunds.values_mut() {
                refunds.outstanding = 0;
            }
        }
        for refund in self
            .pending_payments_queue
            .iter()
            .chain(&awaiting_retry)
            .filter(|payment| matches!(payment.reason, PendingPaymentReason::Refund))
        {
            if let Some(swap) = self.swaps.get_mut(refund.swap_id) {
                swap.on_refund_queued(refund.principal, refund.debit());
            }
        }
    }
}

#[derive(Serialize, Debug)]
pub struct Metrics {
    pub now: TimestampMillis,
    pub heap_memory_used: u64,
    pub stable_memory_used: u64,
    pub cycles_balance: Cycles,
    pub liquid_cycles_balance: Cycles,
    pub wasm_version: BuildVersion,
    pub git_commit_id: String,
    pub swaps: SwapMetrics,
    pub notify_status_change_queue_len: u32,
    pub payments_awaiting_retry: u32,
    pub parked_payments: u32,
    pub stable_memory_sizes: BTreeMap<u8, u64>,
    pub disabled_tokens: Vec<CanisterId>,
    pub canister_ids: CanisterIds,
}

#[derive(Serialize, Debug, Default)]
pub struct SwapMetrics {
    pub total: u32,
    pub open: u32,
    pub cancelled: u32,
    pub expired: u32,
    pub accepted: u32,
    pub completed: u32,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub registry: CanisterId,
    pub cycles_dispenser: CanisterId,
}

pub(crate) fn deposit_address(principal: Principal, swap_id: u32, escrow_canister_id: CanisterId) -> String {
    let account = Account {
        owner: escrow_canister_id,
        subaccount: Some(escrow_canister::deposit_subaccount(principal, swap_id)),
    };

    account.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::swaps::DepositRefunds;
    use std::collections::VecDeque;
    use types::{P2PSwapLocation, TokenInfo};

    fn token() -> TokenInfo {
        TokenInfo {
            symbol: "TEST".to_string(),
            ledger: CanisterId::from_slice(&[1]),
            decimals: 8,
            fee: 10,
        }
    }

    fn refund(swap_id: u32, depositor: Principal, amount: u128) -> PendingPayment {
        PendingPayment {
            principal: depositor,
            timestamp: 0,
            token_info: token(),
            amount,
            swap_id,
            reason: PendingPaymentReason::Refund,
        }
    }

    // Refunds queued before refunds were counted are counted once the canister is upgraded, however
    // many times it's upgraded
    #[test]
    fn refunds_queued_or_parked_are_counted_as_outstanding() {
        let mut data = Data::new(Principal::anonymous(), Principal::anonymous(), true);
        let swap_id = data.swaps.push(
            Principal::from_slice(&[2]),
            escrow_canister::create_swap::Args {
                location: P2PSwapLocation::External,
                token0: token(),
                token0_amount: 1_000,
                token0_principal: None,
                token1: token(),
                token1_amount: 1_000,
                token1_principal: None,
                expires_at: 1,
                additional_admins: Vec::new(),
                canister_to_notify: None,
                is_public: false,
            },
            0,
        );
        let depositor = Principal::from_slice(&[3]);
        let other_depositor = Principal::from_slice(&[4]);

        // As the escrow canister in production stores its queue, with refunds not noted against
        // their deposits
        #[derive(Serialize)]
        struct QueueBeforeRefundsWereCounted {
            pending_payments: VecDeque<PendingPayment>,
            parked: Vec<PendingPayment>,
        }
        let queue = QueueBeforeRefundsWereCounted {
            pending_payments: VecDeque::from([
                refund(swap_id, depositor, 100),
                refund(swap_id, depositor, 200),
                PendingPayment {
                    reason: PendingPaymentReason::Swap(other_depositor),
                    ..refund(swap_id, depositor, 1_000)
                },
            ]),
            parked: vec![refund(swap_id, other_depositor, 50)],
        };
        data.pending_payments_queue = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(queue));

        for _ in 0..2 {
            data.count_outstanding_refunds();

            let swap = data.swaps.get(swap_id).unwrap();
            assert_eq!(
                swap.deposit_refunds(depositor),
                DepositRefunds {
                    outstanding: 320,
                    finished: 0
                }
            );
            assert_eq!(
                swap.deposit_refunds(other_depositor),
                DepositRefunds {
                    outstanding: 60,
                    finished: 0
                }
            );
        }
    }
}
