use crate::HashSet;
use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::update;
use notifications_canister::remove_subscriptions::{Response::*, *};
use std::iter::FromIterator;
use tracing::instrument;

#[update]
#[instrument(level = "trace")]
fn remove_subscriptions(args: Args) -> Response {
    RUNTIME_STATE.with(|state| remove_subscriptions_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn remove_subscriptions_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.is_caller_push_service() {
        for user in args.subscriptions_by_user {
            runtime_state
                .data
                .subscriptions
                .remove_set(user.user_id, HashSet::from_iter(user.p256dh_keys));
        }
        Success
    } else {
        NotAuthorized
    }
}
