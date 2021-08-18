use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::query;
use notifications_canister::queries::subscription_exists::{Response::*, *};

#[query]
fn subscription_exists(args: Args) -> Response {
    RUNTIME_STATE.with(|state| subscription_exists_impl(args, state.borrow().as_ref().unwrap()))
}

fn subscription_exists_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    match runtime_state.data.subscriptions.exists(&args.user_id, args.p256dh_key) {
        true => Yes,
        false => No,
    }
}
