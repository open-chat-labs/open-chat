use crate::{RuntimeState, RUNTIME_STATE};
use canister_api_macros::trace;
use ic_cdk_macros::update;
use notifications_canister::remove_subscription::{Response::*, *};

#[update]
#[trace]
fn remove_subscription(args: Args) -> Response {
    RUNTIME_STATE.with(|state| remove_subscription_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn remove_subscription_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let user_id = runtime_state.env.caller().into();
    runtime_state.data.subscriptions.remove(user_id, args.p256dh_key);
    Success
}
