use crate::{mutate_state, RuntimeState};
use canister_client::make_c2c_call;
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;
use types::{CanisterId, OfferStatus, OfferStatusChange};

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && !state.data.notify_status_change_queue.is_empty() {
        let timer_id = ic_cdk_timers::set_timer_interval(Duration::ZERO, run);
        TIMER_ID.set(Some(timer_id));
        trace!("'notify_status_change' job started");
        true
    } else {
        false
    }
}

pub fn run() {
    if let Some((canister_id, offer_id, status)) = mutate_state(get_next) {
        ic_cdk::spawn(notify_offer_status(canister_id, offer_id, status));
    } else if let Some(timer_id) = TIMER_ID.take() {
        ic_cdk_timers::clear_timer(timer_id);
        trace!("'notify_status_change' job stopped");
    }
}

fn get_next(state: &mut RuntimeState) -> Option<(CanisterId, u32, OfferStatus)> {
    while let Some(id) = state.data.notify_status_change_queue.pop() {
        if let Some((canister_id, offer_id, status)) = state
            .data
            .offers
            .get(id)
            .and_then(|o| o.canister_to_notify.map(|c| (c, o.id, o.status(state.env.now()))))
        {
            return Some((canister_id, offer_id, status));
        }
    }
    None
}

async fn notify_offer_status(canister_id: CanisterId, offer_id: u32, status: OfferStatus) {
    if make_c2c_call(
        canister_id,
        "c2c_notify_p2p_offer_status_change_msgpack",
        OfferStatusChange { offer_id, status },
        msgpack::serialize,
        |r| msgpack::deserialize::<()>(r),
    )
    .await
    .is_err()
    {
        mutate_state(|state| {
            state.data.notify_status_change_queue.push(offer_id);
            start_job_if_required(state);
        });
    }
}
