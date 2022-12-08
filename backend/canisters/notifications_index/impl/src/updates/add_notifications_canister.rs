use crate::guards::caller_is_controller;
use crate::{mutate_state, NotificationsCanister, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use notifications_index_canister::add_notifications_canister::{Response::*, *};
use notifications_index_canister::{NotificationsIndexEvent, SubscriptionAdded};

#[update(guard = "caller_is_controller")]
#[trace]
fn add_notifications_canister(args: Args) -> Response {
    mutate_state(|state| add_notifications_canister_impl(args, state))
}

fn add_notifications_canister_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state
        .data
        .notifications_canisters
        .iter()
        .any(|n| n.canister_id() == args.canister_id)
    {
        AlreadyAdded
    } else {
        let mut notifications_canister = NotificationsCanister::new(args.canister_id);

        for (user_id, subscription) in runtime_state
            .data
            .subscriptions
            .iter()
            .flat_map(|(user_id, subs)| subs.iter().map(|s| (*user_id, s.clone())))
        {
            notifications_canister.enqueue_event(NotificationsIndexEvent::SubscriptionAdded(SubscriptionAdded {
                user_id,
                subscription,
            }));
        }

        runtime_state.data.notifications_canisters.push(notifications_canister);

        Success
    }
}
