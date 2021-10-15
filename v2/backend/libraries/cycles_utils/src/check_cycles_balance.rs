use canister_client_macros::generate_c2c_call;
use ic_cdk::api::call::CallResult;
use tracing::error;
use types::{CanisterId, Cycles};

const FREEZE_THRESHOLD_SECONDS: u32 = 30 * 24 * 60 * 60; // 30 days
const GB_STORAGE_PER_SECOND_FEE: Cycles = 127_000;

pub fn check_cycles_balance(user_cycles_balance: Cycles, top_up_canister_id: CanisterId) {
    if should_notify(user_cycles_balance) {
        ic_cdk::block_on(send_notification(top_up_canister_id));
    }
}

fn should_notify(user_cycles_balance: Cycles) -> bool {
    let total_cycles_balance: Cycles = ic_cdk::api::canister_balance().into();
    let canister_cycles_balance = total_cycles_balance.saturating_sub(user_cycles_balance);
    let freeze_threshold = get_approx_freeze_threshold_cycles();

    canister_cycles_balance < 2 * freeze_threshold
}

fn get_approx_freeze_threshold_cycles() -> Cycles {
    let approx_memory_usage = utils::memory::used();

    let one_gib = 1 << 30;

    approx_memory_usage as u128 * GB_STORAGE_PER_SECOND_FEE * FREEZE_THRESHOLD_SECONDS as u128 / one_gib
}

async fn send_notification(canister_id: CanisterId) {
    let args = c2c_notify_low_balance::Args {};
    if let Ok(response) = c2c_notify_low_balance(canister_id, &args).await {
        if !matches!(response, c2c_notify_low_balance::Response::Success(_)) {
            error!(?response, "Failed to notify low balance");
        }
    }
}

// This is needed because the 'generate_update_call' macro looks for 'c2c_notify_low_balance::Args'
// and 'c2c_notify_low_balance::Response'
mod c2c_notify_low_balance {
    use types::{NotifyLowBalanceArgs, NotifyLowBalanceResponse};

    pub type Args = NotifyLowBalanceArgs;
    pub type Response = NotifyLowBalanceResponse;
}

generate_c2c_call!(c2c_notify_low_balance);
