use crate::consts::CYCLES_REQUIRED_FOR_UPGRADE;
use canister_client::generate_c2c_call;
use std::cmp::max;
use tracing::error;
use types::{CanisterId, Cycles};

const FREEZE_THRESHOLD_SECONDS: u32 = 30 * 24 * 60 * 60; // 30 days
const MIN_CYCLES_BALANCE: Cycles = CYCLES_REQUIRED_FOR_UPGRADE + 50_000_000_000;
const GB_STORAGE_PER_SECOND_FEE: Cycles = 127_000;

pub fn check_cycles_balance(top_up_canister_id: CanisterId) {
    if should_notify() {
        ic_cdk::spawn(send_low_balance_notification(top_up_canister_id));
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
    let cycles_balance: Cycles = ic_cdk::api::canister_balance().into();
    let freeze_threshold = get_approx_freeze_threshold_cycles();

    cycles_balance < max(2 * freeze_threshold, MIN_CYCLES_BALANCE)
}

fn get_approx_freeze_threshold_cycles() -> Cycles {
    let approx_memory_usage = crate::memory::used();

    let one_gib = 1 << 30;

    approx_memory_usage as u128 * GB_STORAGE_PER_SECOND_FEE * FREEZE_THRESHOLD_SECONDS as u128 / one_gib
}

// This is needed because the 'generate_update_call' macro looks for 'c2c_notify_low_balance::Args'
// and 'c2c_notify_low_balance::Response'
mod c2c_notify_low_balance {
    use types::{NotifyLowBalanceArgs, NotifyLowBalanceResponse};

    pub type Args = NotifyLowBalanceArgs;
    pub type Response = NotifyLowBalanceResponse;
}

generate_c2c_call!(c2c_notify_low_balance);
