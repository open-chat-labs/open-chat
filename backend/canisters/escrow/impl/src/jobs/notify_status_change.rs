use crate::{mutate_state, read_state, RuntimeState};
use escrow_canister::SwapStatusChange;
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;
use types::CanisterId;
use utils::canister::should_retry_failed_c2c_call;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && !state.data.notify_status_change_queue.is_empty() {
        let timer_id = ic_cdk_timers::set_timer(Duration::ZERO, run);
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

pub fn run() {
    trace!("'notify_status_change' job running");
    TIMER_ID.set(None);

    if let Some((canister_id, notification)) = mutate_state(get_next) {
        ic_cdk::futures::spawn(notify_swap_status(canister_id, notification));
        read_state(start_job_if_required);
    }
}

fn get_next(state: &mut RuntimeState) -> Option<(CanisterId, SwapStatusChange)> {
    while let Some(id) = state.data.notify_status_change_queue.pop() {
        if let Some(notification) = state.data.swaps.get(id).and_then(|swap| {
            swap.canister_to_notify.map(|canister_id| {
                (
                    canister_id,
                    SwapStatusChange {
                        swap_id: swap.id,
                        created_by: swap.created_by,
                        location: swap.location.clone(),
                        status: swap.status(state.env.now()),
                    },
                )
            })
        }) {
            return Some(notification);
        }
    }
    None
}

async fn notify_swap_status(canister_id: CanisterId, notification: SwapStatusChange) {
    let swap_id = notification.swap_id;

    if let Err((code, msg)) = c2c_notify_p2p_swap_status_change(canister_id, &notification).await {
        if should_retry_failed_c2c_call(code, &msg) {
            mutate_state(|state| {
                state.data.notify_status_change_queue.push(swap_id);
                start_job_if_required(state);
            });
        }
    }
}

canister_client::generate_c2c_call!(c2c_notify_p2p_swap_status_change);

mod c2c_notify_p2p_swap_status_change {
    use super::*;

    pub type Args = SwapStatusChange;
    pub type Response = ();
}
