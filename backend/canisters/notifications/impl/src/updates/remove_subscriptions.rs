use crate::guards::caller_is_push_service;
use crate::RuntimeState;
use crate::{mutate_state, HashSet};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use notifications_canister::remove_subscriptions::{Response::*, *};
use std::iter::FromIterator;

#[update(guard = "caller_is_push_service")]
#[trace]
fn remove_subscriptions(args: Args) -> Response {
    mutate_state(|state| remove_subscriptions_impl(args, state))
}

fn remove_subscriptions_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    for user in args.subscriptions_by_user {
        runtime_state
            .data
            .subscriptions
            .remove_set(user.user_id, HashSet::from_iter(user.p256dh_keys));
    }
    Success
}
