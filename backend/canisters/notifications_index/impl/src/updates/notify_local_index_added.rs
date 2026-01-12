use crate::guards::caller_is_registry_canister;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use notifications_index_canister::notify_local_index_added::*;
use notifications_index_canister::{NotificationsIndexEvent, SubscriptionAdded};
use oc_error_codes::OCErrorCode;
use rand::RngCore;
use types::IdempotentEnvelope;

#[update(guard = "caller_is_registry_canister", msgpack = true)]
#[trace]
fn notify_local_index_added(args: Args) -> Response {
    mutate_state(|state| notify_local_index_added_impl(args, state))
}

fn notify_local_index_added_impl(args: Args, state: &mut RuntimeState) -> Response {
    if !state.data.local_indexes.insert(args.canister_id) {
        return Response::Error(OCErrorCode::AlreadyAdded.into());
    }

    let mut events = vec![NotificationsIndexEvent::SetNotificationPusherPrincipals(
        state.data.push_service_principals.clone(),
    )];

    let now = state.env.now();
    for (user_id, subscription) in state
        .data
        .subscriptions
        .iter()
        .flat_map(|(user_id, subs)| subs.iter().map(|s| (*user_id, s.clone())))
    {
        events.push(NotificationsIndexEvent::SubscriptionAdded(SubscriptionAdded {
            user_id,
            subscription: subscription.into(),
        }));
    }

    state.data.local_index_event_sync_queue.push_many(
        args.canister_id,
        events
            .iter()
            .map(|e| IdempotentEnvelope {
                created_at: now,
                idempotency_id: state.env.rng().next_u64(),
                value: e.clone(),
            })
            .collect(),
    );

    Response::Success
}
