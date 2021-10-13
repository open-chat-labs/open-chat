use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::update;
use notifications_canister::push_subscription::{Response::*, *};
use tracing::instrument;

#[update]
#[instrument(level = "trace")]
fn push_subscription(args: Args) -> Response {
    RUNTIME_STATE.with(|state| push_subscription_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn push_subscription_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let now = runtime_state.env.now();
    runtime_state.data.subscriptions.push(args.user_id, args.subscription, now);
    Success
}
