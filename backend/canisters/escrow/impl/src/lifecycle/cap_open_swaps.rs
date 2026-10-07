use crate::Data;
use crate::model::notify_status_change_queue::NotifyStatusChangeQueue;
use crate::model::pending_payments_queue::PendingPaymentsQueue;
use crate::model::swaps::{Swaps, latest_allowed_expiry};
use crate::timer_job_types::TimerJob;
use escrow_canister::SwapStatus;
use tracing::info;
use types::TimestampMillis;

// One-off, now that a swap can stay open for at most `P2P_SWAP_MAX_EXPIRY`: cancels the open swaps
// set to stay open for longer, refunding whatever has been deposited into them. Hundreds were created
// with expiries decades away, and a user's canister isn't migrated to a MultiUser canister while one
// of their swaps is unexpired.
// TODO remove after the release containing this has been deployed
pub(crate) fn cap_open_swaps(data: &mut Data, now: TimestampMillis) {
    let cancelled = cancel_swaps_over_the_cap(
        &mut data.swaps,
        &mut data.pending_payments_queue,
        &mut data.notify_status_change_queue,
        now,
    );

    for &id in cancelled.iter() {
        data.timer_jobs
            .cancel_jobs(|job| matches!(job, TimerJob::ExpireSwap(j) if j.swap_id == id));
    }

    info!(
        cancelled = cancelled.len(),
        "Cancelled the open swaps set to stay open for too long"
    );
}

// Returns the ids of the swaps cancelled
fn cancel_swaps_over_the_cap(
    swaps: &mut Swaps,
    pending_payments_queue: &mut PendingPaymentsQueue,
    notify_status_change_queue: &mut NotifyStatusChangeQueue,
    now: TimestampMillis,
) -> Vec<u32> {
    let ids: Vec<u32> = swaps
        .iter()
        .filter(|swap| matches!(swap.status(now), SwapStatus::Open) && swap.expires_at > latest_allowed_expiry(swap.created_at))
        .map(|swap| swap.id)
        .collect();

    for &id in ids.iter() {
        if let Some(swap) = swaps.get_mut(id) {
            swap.cancelled_at = Some(now);
            pending_payments_queue.push_refunds(swap, now);
            // Its canister is notified now, rather than only once a refund has been made, since a
            // refund from a ledger which has since been uninstalled is parked and never made. It is
            // notified again once a refund is made, with the refund included.
            notify_status_change_queue.push(id);
        }
    }
    ids
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
                    token1_amount: 2_000,
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

        fn cancel(&mut self) -> Vec<u32> {
            cancel_swaps_over_the_cap(
                &mut self.swaps,
                &mut self.pending_payments_queue,
                &mut self.notify_status_change_queue,
                NOW,
            )
        }

        fn refunds(&mut self) -> Vec<(u32, Principal, u128)> {
            std::iter::from_fn(|| self.pending_payments_queue.pop())
                .map(|p| (p.swap_id, p.principal, p.amount))
                .collect()
        }

        fn notifications(&mut self) -> Vec<u32> {
            std::iter::from_fn(|| self.notify_status_change_queue.pop()).collect()
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
    fn open_swap_set_to_stay_open_too_long_is_cancelled_refunded_and_notified() {
        let mut state = State::default();
        let old = state.add_swap(NOW - 600 * DAY_IN_MS, 10_000 * DAY_IN_MS);
        // Created recently, but with an expiry beyond the maximum
        let recent = state.add_swap(NOW - DAY_IN_MS, 365 * DAY_IN_MS);

        assert_eq!(state.cancel(), vec![old, recent]);

        for id in [old, recent] {
            let swap = state.swap(id);
            assert_eq!(swap.cancelled_at, Some(NOW));
            assert!(matches!(swap.status(NOW), SwapStatus::Cancelled(_)));
        }
        let offered_by = state.swap(old).offered_by;
        assert_eq!(state.refunds(), vec![(old, offered_by, 1_000), (recent, offered_by, 1_000)]);
        assert_eq!(state.notifications(), vec![old, recent]);
    }

    #[test]
    fn cancelled_swap_with_nothing_deposited_is_notified() {
        let mut state = State::default();
        let id = state.add_swap(NOW - 600 * DAY_IN_MS, 10_000 * DAY_IN_MS);
        state.swap_mut(id).token0_received = false;

        assert_eq!(state.cancel(), vec![id]);

        assert_eq!(state.swap(id).cancelled_at, Some(NOW));
        assert!(state.refunds().is_empty());
        assert_eq!(state.notifications(), vec![id]);
    }

    #[test]
    fn accepters_deposit_is_refunded_though_the_offer_was_never_deposited() {
        let mut state = State::default();
        let id = state.add_swap(NOW - 600 * DAY_IN_MS, 10_000 * DAY_IN_MS);
        let accepter = Principal::from_slice(&[8]);
        {
            let swap = state.swap_mut(id);
            swap.token0_received = false;
            swap.token1_received = true;
            swap.accepted_by = Some((accepter, NOW - 500 * DAY_IN_MS));
        }
        // Without the offer, the swap counts as open rather than accepted
        assert!(matches!(state.swap(id).status(NOW), SwapStatus::Open));

        assert_eq!(state.cancel(), vec![id]);

        assert_eq!(state.refunds(), vec![(id, accepter, 2_000)]);
        assert_eq!(state.notifications(), vec![id]);
    }

    #[test]
    fn other_swaps_are_left_alone() {
        let mut state = State::default();
        // Within the maximum
        let short = state.add_swap(NOW - DAY_IN_MS, 7 * DAY_IN_MS);
        // The longest `create_swap` allows, including what it allows for the caller's clock being ahead
        let longest = state.add_swap(NOW - DAY_IN_MS, latest_allowed_expiry(0));
        // Already expired
        let expired = state.add_swap(NOW - 600 * DAY_IN_MS, DAY_IN_MS);
        // Accepted, though not yet paid out
        let accepted = state.add_swap(NOW - 600 * DAY_IN_MS, 10_000 * DAY_IN_MS);
        state.swap_mut(accepted).accepted_by = Some((Principal::from_slice(&[8]), NOW - 500 * DAY_IN_MS));
        // Cancelled by its offerer
        let cancelled = state.add_swap(NOW - 600 * DAY_IN_MS, 10_000 * DAY_IN_MS);
        state.swap_mut(cancelled).cancelled_at = Some(NOW - 500 * DAY_IN_MS);

        assert!(state.cancel().is_empty());

        for id in [short, longest, expired, accepted] {
            assert_eq!(state.swap(id).cancelled_at, None, "{id}");
        }
        assert_eq!(state.swap(cancelled).cancelled_at, Some(NOW - 500 * DAY_IN_MS));
        assert!(state.refunds().is_empty());
        assert!(state.notifications().is_empty());
    }
}
