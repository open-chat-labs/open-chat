use canister_client::generate_c2c_call;
use constants::CYCLES_REQUIRED_FOR_UPGRADE;
use std::cmp::max;
use tracing::error;
use types::{CanisterId, Cycles};

pub const MIN_CYCLES_BALANCE: Cycles = CYCLES_REQUIRED_FOR_UPGRADE + 50_000_000_000;

// Asking for a top up is itself a call, which fails unless the liquid balance covers its cost (~42B
// cycles) on top of the cycles reserved for executing the message making it (~40B for an update,
// ~80B for a timer, which ic-cdk-timers runs via a self-call). The balance is only checked every few
// minutes, so a canister asks for a top up while its liquid balance is still far enough above that
// to last until the next check.
const MIN_LIQUID_CYCLES_BALANCE: Cycles = 250_000_000_000;

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
    is_balance_low(
        ic_cdk::api::canister_cycle_balance(),
        ic_cdk::api::canister_liquid_cycle_balance(),
        min_cycles_balance,
    )
}

fn is_balance_low(cycles_balance: Cycles, liquid_cycles: Cycles, min_cycles_balance: Cycles) -> bool {
    let freeze_threshold = cycles_balance.saturating_sub(liquid_cycles);

    cycles_balance < max(2 * freeze_threshold, min_cycles_balance) || liquid_cycles < MIN_LIQUID_CYCLES_BALANCE
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

    const B: Cycles = 1_000_000_000;

    #[test]
    fn low_when_below_the_min_balance() {
        assert!(is_balance_low(349 * B, 340 * B, MIN_CYCLES_BALANCE));
        assert!(!is_balance_low(360 * B, 351 * B, MIN_CYCLES_BALANCE));
    }

    // A canister with a large freezing threshold (eg. one using a lot of memory) is low once its
    // balance is less than twice the threshold, ie. once its liquid balance is less than the threshold
    #[test]
    fn low_when_below_twice_the_freezing_threshold() {
        assert!(is_balance_low(839 * B, 419 * B, MIN_CYCLES_BALANCE));
        assert!(!is_balance_low(841 * B, 421 * B, MIN_CYCLES_BALANCE));
    }

    // Each balance here is above both the min balance and twice the freezing threshold
    #[test]
    fn low_when_the_liquid_balance_is_below_the_min_liquid_balance() {
        assert!(is_balance_low(400 * B, 249 * B, MIN_CYCLES_BALANCE));
        assert!(!is_balance_low(400 * B, 250 * B, MIN_CYCLES_BALANCE));
    }

    // MultiUser canisters keep a larger balance than the default
    #[test]
    fn a_larger_min_balance_applies_in_place_of_the_default() {
        assert!(is_balance_low(9_999 * B, 9_990 * B, 10_000 * B));
        assert!(!is_balance_low(10_000 * B, 9_990 * B, 10_000 * B));
    }
}
