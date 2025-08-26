use crate::guards::caller_is_push_service;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use notifications_index_canister::remove_subscriptions::*;

#[update(guard = "caller_is_push_service", candid = true, msgpack = true)]
#[trace]
fn remove_subscriptions(args: Args) -> Response {
    mutate_state(|state| remove_subscriptions_impl(args, state))
}

fn remove_subscriptions_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    for user in args.subscriptions_by_user {
        for key in user.p256dh_keys {
            state.remove_subscription(user.user_id, key, now);
        }
    }
    Response::Success
}
