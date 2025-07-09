use crate::guards::{caller_is_local_community_canister, caller_is_local_group_canister};
use crate::{RuntimeState, mutate_state};
use candid::Principal;
use canister_api_macros::update;
use canister_time::now_millis;
use canister_tracing_macros::trace;
use local_user_index_canister::GroupEvent;
use local_user_index_canister::c2c_group_canister::*;
use std::cell::LazyCell;
use types::TimestampMillis;

#[update(guard = "caller_is_local_group_canister", msgpack = true)]
#[trace]
fn c2c_group_canister(args: Args) -> Response {
    mutate_state(|state| c2c_group_or_community_canister_impl(args, true, state))
}

#[update(guard = "caller_is_local_community_canister", msgpack = true)]
#[trace]
fn c2c_community_canister(
    args: local_user_index_canister::c2c_community_canister::Args,
) -> local_user_index_canister::c2c_community_canister::Response {
    mutate_state(|state| c2c_group_or_community_canister_impl(args, false, state))
}

fn c2c_group_or_community_canister_impl(args: Args, is_group: bool, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    let now = LazyCell::new(now_millis);
    for event in args.events {
        if state
            .data
            .idempotency_checker
            .check(caller, event.created_at, event.idempotency_id)
        {
            handle_event(caller, is_group, event.value, &now, state);
        }
    }
    Response::Success
}

fn handle_event<F: FnOnce() -> TimestampMillis>(
    caller: Principal,
    is_group: bool,
    event: GroupEvent,
    now: &LazyCell<TimestampMillis, F>,
    state: &mut RuntimeState,
) {
    match event {
        GroupEvent::MarkActivity(timestamp) => {
            if is_group {
                state.data.local_groups.mark_activity(&caller.into(), timestamp);
            } else {
                state.data.local_communities.mark_activity(&caller.into(), timestamp);
            }
        }
        GroupEvent::MarkActivityForUser(timestamp, user_id) => {
            if is_group {
                state
                    .data
                    .local_groups
                    .mark_activity_for_user(&caller.into(), user_id, timestamp);
            } else {
                state
                    .data
                    .local_communities
                    .mark_activity_for_user(&caller.into(), user_id, timestamp);
            }
        }
        GroupEvent::EventStoreEvent(event) => state.data.event_store_client.push(event),
        GroupEvent::Notification(notification) => state.data.handle_notification(*notification, state.env.canister_id(), **now),
    }
}
