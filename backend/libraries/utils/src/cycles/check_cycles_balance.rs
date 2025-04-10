use canister_client::generate_c2c_call;
use constants::CYCLES_REQUIRED_FOR_UPGRADE;
use std::cmp::max;
use tracing::error;
use types::{CanisterId, Cycles};

const FREEZE_THRESHOLD_SECONDS: u32 = 30 * 24 * 60 * 60; // 30 days
pub const MIN_CYCLES_BALANCE: Cycles = CYCLES_REQUIRED_FOR_UPGRADE + 50_000_000_000;
const GB_STORAGE_PER_SECOND_FEE: Cycles = 127_000;

pub fn check_cycles_balance(top_up_canister_id: CanisterId) {
    if should_notify() {
        ic_cdk::futures::spawn(send_low_balance_notification(top_up_canister_id));
    }
}

pub async fn send_low_balance_notification(canister_id: CanisterId) {
    let args = c2c_notify_low_balance::Args {};
    if let Ok(response) = c2c_notify_low_balance(canister_id, &args).await {
        if !matches!(response, c2c_notify_low_balance::Response::Success(_)) {
            error!(?response, "Failed to notify low balance");
        }
    }
}

fn should_notify() -> bool {
    let cycles_balance = ic_cdk::api::canister_cycle_balance();
    let liquid_cycles = ic_cdk::api::canister_liquid_cycle_balance();
    let freeze_threshold = cycles_balance.saturating_sub(liquid_cycles);

    cycles_balance < max(2 * freeze_threshold, MIN_CYCLES_BALANCE)
}

// This is needed because the 'generate_update_call' macro looks for 'c2c_notify_low_balance::Args'
// and 'c2c_notify_low_balance::Response'
mod c2c_notify_low_balance {
    use types::{NotifyLowBalanceArgs, NotifyLowBalanceResponse};

    pub type Args = NotifyLowBalanceArgs;
    pub type Response = NotifyLowBalanceResponse;
}

generate_c2c_call!(c2c_notify_low_balance);
