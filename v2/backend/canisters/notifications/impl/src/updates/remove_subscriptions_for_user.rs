use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::update;
use notifications_canister::remove_subscriptions_for_user::{Response::*, *};
use tracing::instrument;

#[update]
#[instrument(level = "trace")]
fn remove_subscriptions_for_user(_args: Args) -> Response {
    RUNTIME_STATE.with(|state| remove_subscriptions_for_user_impl(state.borrow_mut().as_mut().unwrap()))
}

fn remove_subscriptions_for_user_impl(runtime_state: &mut RuntimeState) -> Response {
    let user_id = runtime_state.env.caller().into();
    runtime_state.data.subscriptions.remove_all(user_id);
    Success
}
