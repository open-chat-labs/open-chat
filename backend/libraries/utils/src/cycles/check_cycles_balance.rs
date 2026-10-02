use canister_client::generate_c2c_call;
use constants::T;
use std::cmp::max;
use tracing::error;
use types::{CanisterId, Cycles};

// The cycles a canister keeps available to spend, ie. above its freezing threshold. Well above what
// an upgrade needs, so that a canister which goes quiet, and so stops checking its balance, has
// months of cycles before it freezes.
pub const MIN_CYCLES_BALANCE: Cycles = T; // 1T

pub fn check_cycles_balance(top_up_canister_id: CanisterId) {
    check_cycles_balance_with_min(top_up_canister_id, MIN_CYCLES_BALANCE);
}

// As `check_cycles_balance`, but for canisters which keep a balance above `MIN_CYCLES_BALANCE`
pub fn check_cycles_balance_with_min(top_up_canister_id: CanisterId, min_cycles_balance: Cycles) {
    if should_notify(min_cycles_balance) {
        ic_cdk::futures::spawn_migratory(send_low_balance_notification(top_up_canister_id));
    }
}

pub async fn send_low_balance_notification(canister_id: CanisterId) {
    let args = c2c_notify_low_balance::Args {};
    if let Ok(response) = c2c_notify_low_balance(canister_id, &args).await
        && !matches!(response, c2c_notify_low_balance::Response::Success(_))
    {
        error!(?response, "Failed to notify low balance");
    }
}

fn should_notify(min_cycles_balance: Cycles) -> bool {
    let cycles_balance = ic_cdk::api::canister_cycle_balance();
    let liquid_cycles = ic_cdk::api::canister_liquid_cycle_balance();
    let freeze_threshold = cycles_balance.saturating_sub(liquid_cycles);

    is_cycles_balance_low(cycles_balance, freeze_threshold, min_cycles_balance)
}

// Whether the cycles available to spend, ie. those above the freezing threshold, are below
// `min_cycles_balance` or below twice the freezing threshold. At the default freezing threshold of
// 30 days the latter means below 60 days of idle burn, which is what a large canister runs out of
// first.
pub fn is_cycles_balance_low(cycles_balance: Cycles, freeze_threshold: Cycles, min_cycles_balance: Cycles) -> bool {
    let liquid_cycles = cycles_balance.saturating_sub(freeze_threshold);
    liquid_cycles < max(2 * freeze_threshold, min_cycles_balance)
}

// The cycles a canister must keep to not be frozen, worked out as the IC does: the cycles it burns
// while idle over the freezing threshold, less those it holds in reserve
pub fn freeze_threshold_cycles(
    idle_cycles_burned_per_day: Cycles,
    freezing_threshold_secs: u64,
    reserved_cycles: Cycles,
) -> Cycles {
    let threshold = idle_cycles_burned_per_day.saturating_mul(freezing_threshold_secs as Cycles) / (24 * 60 * 60);
    threshold.saturating_sub(reserved_cycles)
}

// This is needed because the 'generate_update_call' macro looks for 'c2c_notify_low_balance::Args'
// and 'c2c_notify_low_balance::Response'
mod c2c_notify_low_balance {
    use types::{NotifyLowBalanceArgs, NotifyLowBalanceResponse};

    pub type Args = NotifyLowBalanceArgs;
    pub type Response = NotifyLowBalanceResponse;
}

generate_c2c_call!(c2c_notify_low_balance);

#[cfg(test)]
mod tests {
    use super::*;
    use constants::B;

    #[test]
    fn a_small_canister_keeps_the_minimum_above_its_freezing_threshold() {
        let freeze_threshold = 40 * B;
        assert!(is_cycles_balance_low(
            MIN_CYCLES_BALANCE + freeze_threshold - 1,
            freeze_threshold,
            MIN_CYCLES_BALANCE
        ));
        assert!(!is_cycles_balance_low(
            MIN_CYCLES_BALANCE + freeze_threshold,
            freeze_threshold,
            MIN_CYCLES_BALANCE
        ));
    }

    #[test]
    fn a_large_canister_keeps_twice_its_freezing_threshold_above_it() {
        let freeze_threshold = MIN_CYCLES_BALANCE;
        assert!(is_cycles_balance_low(
            3 * freeze_threshold - 1,
            freeze_threshold,
            MIN_CYCLES_BALANCE
        ));
        assert!(!is_cycles_balance_low(
            3 * freeze_threshold,
            freeze_threshold,
            MIN_CYCLES_BALANCE
        ));
    }

    #[test]
    fn a_canister_below_its_freezing_threshold_is_low() {
        assert!(is_cycles_balance_low(10 * B, 20 * B, MIN_CYCLES_BALANCE));
    }

    #[test]
    fn the_freeze_threshold_is_the_idle_burn_over_the_freezing_threshold() {
        let thirty_days_secs = 30 * 24 * 60 * 60;
        assert_eq!(freeze_threshold_cycles(2 * B, thirty_days_secs, 0), 60 * B);
        assert_eq!(freeze_threshold_cycles(2 * B, 12 * 60 * 60, 0), B);
    }

    #[test]
    fn reserved_cycles_count_towards_the_freeze_threshold() {
        let thirty_days_secs = 30 * 24 * 60 * 60;
        assert_eq!(freeze_threshold_cycles(2 * B, thirty_days_secs, 10 * B), 50 * B);
        assert_eq!(freeze_threshold_cycles(2 * B, thirty_days_secs, 100 * B), 0);
    }
}
