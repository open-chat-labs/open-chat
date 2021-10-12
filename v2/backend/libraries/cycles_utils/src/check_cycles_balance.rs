use crate::{State, STATE};
use canister_client_macros::generate_c2c_call;
use ic_cdk::api::call::CallResult;
use tracing::error;
use types::{CanisterId, Milliseconds};

const MIN_NOTIFICATION_INTERVAL: Milliseconds = 60 * 1000; // 1 minute

pub fn check_cycles_balance() {
    if let ShouldNotifyResult::Yes(canister_id) = STATE.with(|state| should_notify(&mut state.borrow_mut())) {
        ic_cdk::block_on(send_notification(canister_id));
    }
}

enum ShouldNotifyResult {
    Yes(CanisterId),
    No,
}

fn should_notify(state: &mut State) -> ShouldNotifyResult {
    if state.in_progress {
        return ShouldNotifyResult::No;
    }

    let cycles_balance = ic_cdk::api::canister_balance();
    if cycles_balance > state.low_balance_threshold {
        return ShouldNotifyResult::No;
    }

    let now = ic_cdk::api::time();
    if now < state.last_notified + MIN_NOTIFICATION_INTERVAL {
        return ShouldNotifyResult::No;
    }

    state.in_progress = true;
    ShouldNotifyResult::Yes(state.top_up_canister_id)
}

async fn send_notification(canister_id: CanisterId) {
    let args = c2c_notify_low_balance::Args {};
    if let Ok(response) = c2c_notify_low_balance(canister_id, &args).await {
        if !matches!(response, c2c_notify_low_balance::Response::Success(_)) {
            error!(?response, "Failed to notify low balance");
        }
    }

    // We mark as complete regardless of if the top up succeeded or not.
    // If it failed the balance will still be low so it will simply retry on the next update call
    // that occurs after the minimum interval has passed.
    STATE.with(|state| mark_notification_completed(&mut state.borrow_mut()));
}

fn mark_notification_completed(state: &mut State) {
    let now = ic_cdk::api::time();
    state.in_progress = false;
    state.last_notified = now;
}

// This is needed because the 'generate_update_call' macro looks for 'c2c_notify_low_balance::Args'
// and 'c2c_notify_low_balance::Response'
mod c2c_notify_low_balance {
    use types::{NotifyLowBalanceArgs, NotifyLowBalanceResponse};

    pub type Args = NotifyLowBalanceArgs;
    pub type Response = NotifyLowBalanceResponse;
}

generate_c2c_call!(c2c_notify_low_balance);
