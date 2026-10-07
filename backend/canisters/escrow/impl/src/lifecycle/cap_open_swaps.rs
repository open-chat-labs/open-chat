use crate::Data;
use crate::model::notify_status_change_queue::NotifyStatusChangeQueue;
use crate::model::pending_payments_queue::PendingPaymentsQueue;
use crate::model::swaps::Swaps;
use crate::timer_job_types::{ExpireSwapJob, TimerJob};
use constants::P2P_SWAP_MAX_EXPIRY;
use escrow_canister::SwapStatus;
use tracing::info;
use types::TimestampMillis;

// One-off, now that a swap can stay open for at most `P2P_SWAP_MAX_EXPIRY`: cancels the open swaps
// created longer ago than that, refunding their deposits, and brings forward the expiry of any other
// open swap to that long after it was created. Hundreds were created with expiries decades away,
// and a user's canister isn't migrated to a MultiUser canister while one of their swaps is unexpired.
// TODO remove after the release containing this has been deployed
pub(crate) fn cap_open_swaps(data: &mut Data, now: TimestampMillis) {
    let capped = cap_swaps(
        &mut data.swaps,
        &mut data.pending_payments_queue,
        &mut data.notify_status_change_queue,
        now,
    );

    for &(id, new_expiry) in capped.iter() {
        data.timer_jobs
            .cancel_jobs(|job| matches!(job, TimerJob::ExpireSwap(j) if j.swap_id == id));
        if let Some(expires_at) = new_expiry {
            data.timer_jobs
                .enqueue_job(TimerJob::ExpireSwap(Box::new(ExpireSwapJob { swap_id: id })), expires_at, now);
        }
    }

    let shortened = capped.iter().filter(|(_, new_expiry)| new_expiry.is_some()).count();
    let cancelled = capped.len() - shortened;
    info!(cancelled, shortened, "Capped how long the open swaps stay open");
}

// Returns each swap capped, with its new expiry if it was shortened, or `None` if it was cancelled
fn cap_swaps(
    swaps: &mut Swaps,
    pending_payments_queue: &mut PendingPaymentsQueue,
    notify_status_change_queue: &mut NotifyStatusChangeQueue,
    now: TimestampMillis,
) -> Vec<(u32, Option<TimestampMillis>)> {
    let ids: Vec<u32> = swaps
        .iter()
        .filter(|swap| matches!(swap.status(now), SwapStatus::Open) && swap.expires_at > swap.created_at + P2P_SWAP_MAX_EXPIRY)
        .map(|swap| swap.id)
        .collect();

    let mut capped = Vec::new();
    for id in ids {
        let Some(swap) = swaps.get_mut(id) else {
            continue;
        };
        let capped_expiry = swap.created_at + P2P_SWAP_MAX_EXPIRY;
        if capped_expiry <= now {
            swap.cancelled_at = Some(now);
            if swap.token0_received {
                // Its canister is notified of the cancellation once the refund has been made
                pending_payments_queue.push_refunds(swap, now);
            } else {
                notify_status_change_queue.push(id);
            }
            capped.push((id, None));
        } else {
            swap.expires_at = capped_expiry;
            capped.push((id, Some(capped_expiry)));
        }
    }
    capped
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::swaps::Swap;
    use candid::Principal;
    use constants::DAY_IN_MS;
    use types::{CanisterId, P2PSwapLocation, TokenInfo};

    const NOW: TimestampMillis = 1_000 * DAY_IN_MS;

    #[derive(Default)]
    struct State {
        swaps: Swaps,
        pending_payments_queue: PendingPaymentsQueue,
        notify_status_change_queue: NotifyStatusChangeQueue,
    }

    impl State {
        // Adds a swap created at `created`, expiring `expires_in` later, with its offer deposited
        fn add_swap(&mut self, created: TimestampMillis, expires_in: u64) -> u32 {
            let id = self.swaps.push(
                Principal::from_slice(&[9]),
                escrow_canister::create_swap::Args {
                    location: P2PSwapLocation::External,
                    token0: token(1),
                    token0_amount: 1_000,
                    token0_principal: None,
                    token1: token(2),
                    token1_amount: 1_000,
                    token1_principal: None,
                    expires_at: created + expires_in,
                    additional_admins: Vec::new(),
                    canister_to_notify: None,
                    is_public: false,
                },
                created,
            );
            self.swap_mut(id).token0_received = true;
            id
        }

        fn swap(&self, id: u32) -> &Swap {
            self.swaps.get(id).unwrap()
        }

        fn swap_mut(&mut self, id: u32) -> &mut Swap {
            self.swaps.get_mut(id).unwrap()
        }

        fn cap(&mut self) -> Vec<(u32, Option<TimestampMillis>)> {
            cap_swaps(
                &mut self.swaps,
                &mut self.pending_payments_queue,
                &mut self.notify_status_change_queue,
                NOW,
            )
        }
    }

    fn token(ledger: u8) -> TokenInfo {
        TokenInfo {
            symbol: format!("TOKEN{ledger}"),
            ledger: CanisterId::from_slice(&[ledger]),
            decimals: 8,
            fee: 10_000,
        }
    }

    #[test]
    fn open_swap_created_over_the_maximum_ago_is_cancelled_and_refunded() {
        let mut state = State::default();
        let id = state.add_swap(NOW - 600 * DAY_IN_MS, 10_000 * DAY_IN_MS);

        assert_eq!(state.cap(), vec![(id, None)]);

        let swap = state.swap(id);
        assert_eq!(swap.cancelled_at, Some(NOW));
        assert!(matches!(swap.status(NOW), SwapStatus::Cancelled(_)));
        let offered_by = swap.offered_by;
        let refund = state.pending_payments_queue.pop().unwrap();
        assert_eq!((refund.swap_id, refund.principal), (id, offered_by));
        assert!(state.pending_payments_queue.is_empty());
        // Its canister is notified once the refund has been made
        assert!(state.notify_status_change_queue.is_empty());
    }

    #[test]
    fn cancelled_swap_with_nothing_to_refund_notifies_its_canister() {
        let mut state = State::default();
        let id = state.add_swap(NOW - 600 * DAY_IN_MS, 10_000 * DAY_IN_MS);
        state.swap_mut(id).token0_received = false;

        assert_eq!(state.cap(), vec![(id, None)]);

        assert_eq!(state.swap(id).cancelled_at, Some(NOW));
        assert!(state.pending_payments_queue.is_empty());
        assert_eq!(state.notify_status_change_queue.pop(), Some(id));
    }

    #[test]
    fn newer_open_swap_expires_the_maximum_after_it_was_created() {
        let mut state = State::default();
        let created = NOW - 10 * DAY_IN_MS;
        let id = state.add_swap(created, 365 * DAY_IN_MS);

        assert_eq!(state.cap(), vec![(id, Some(created + P2P_SWAP_MAX_EXPIRY))]);

        let swap = state.swap(id);
        assert_eq!(swap.cancelled_at, None);
        assert_eq!(swap.expires_at, created + P2P_SWAP_MAX_EXPIRY);
        assert!(matches!(swap.status(NOW), SwapStatus::Open));
        assert!(state.pending_payments_queue.is_empty());
    }

    #[test]
    fn other_swaps_are_left_alone() {
        let mut state = State::default();
        // Within the maximum
        let short = state.add_swap(NOW - DAY_IN_MS, 7 * DAY_IN_MS);
        // Already expired
        let expired = state.add_swap(NOW - 600 * DAY_IN_MS, DAY_IN_MS);
        // Accepted, though not yet paid out
        let accepted = state.add_swap(NOW - 600 * DAY_IN_MS, 10_000 * DAY_IN_MS);
        state.swap_mut(accepted).accepted_by = Some((Principal::from_slice(&[8]), NOW - 500 * DAY_IN_MS));
        // Cancelled by its offerer
        let cancelled = state.add_swap(NOW - 600 * DAY_IN_MS, 10_000 * DAY_IN_MS);
        state.swap_mut(cancelled).cancelled_at = Some(NOW - 500 * DAY_IN_MS);

        assert!(state.cap().is_empty());

        for (id, expires_in) in [
            (short, 7 * DAY_IN_MS),
            (expired, DAY_IN_MS),
            (accepted, 10_000 * DAY_IN_MS),
            (cancelled, 10_000 * DAY_IN_MS),
        ] {
            let swap = state.swap(id);
            assert_eq!(swap.expires_at, swap.created_at + expires_in, "{id}");
        }
        assert_eq!(state.swap(cancelled).cancelled_at, Some(NOW - 500 * DAY_IN_MS));
        assert_eq!(state.swap(accepted).cancelled_at, None);
        assert!(state.pending_payments_queue.is_empty());
        assert!(state.notify_status_change_queue.is_empty());
    }
}
