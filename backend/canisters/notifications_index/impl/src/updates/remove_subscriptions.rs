use crate::guards::caller_is_push_service;
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use notifications_index_canister::remove_subscriptions::{Response::*, *};

#[update(guard = "caller_is_push_service")]
#[trace]
fn remove_subscriptions(args: Args) -> Response {
    mutate_state(|state| remove_subscriptions_impl(args, state))
}

fn remove_subscriptions_impl(args: Args, state: &mut RuntimeState) -> Response {
    for user in args.subscriptions_by_user {
        for key in user.p256dh_keys {
            state.remove_subscription(user.user_id, key);
        }
    }
    Success
}
