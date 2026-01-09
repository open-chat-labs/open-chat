use crate::guards::{caller_is_local_community_canister, caller_is_local_group_canister};
use crate::{RuntimeState, mutate_state};
use candid::Principal;
use canister_api_macros::update;
use canister_time::now_millis;
use canister_tracing_macros::trace;
use local_user_index_canister::GroupOrCommunityEvent;
use local_user_index_canister::c2c_group_canister::*;
use std::cell::LazyCell;
use types::{BotEvent, BotLifecycleEvent, Notification, TimestampMillis};
use user_index_canister::BotInstalled;

#[update(guard = "caller_is_local_group_canister", msgpack = true)]
#[trace]
fn c2c_group_canister(args: ArgsInternal) -> Response {
    mutate_state(|state| c2c_group_or_community_canister_impl(args, true, state))
}

#[update(guard = "caller_is_local_community_canister", msgpack = true)]
#[trace]
fn c2c_community_canister(
    args: local_user_index_canister::c2c_community_canister::ArgsInternal,
) -> local_user_index_canister::c2c_community_canister::Response {
    mutate_state(|state| c2c_group_or_community_canister_impl(args, false, state))
}

fn c2c_group_or_community_canister_impl(args: ArgsInternal, is_group: bool, state: &mut RuntimeState) -> Response {
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
    event: GroupOrCommunityEvent,
    now: &LazyCell<TimestampMillis, F>,
    state: &mut RuntimeState,
) {
    match event {
        GroupOrCommunityEvent::MarkActivity(timestamp) => {
            if is_group {
                state.data.local_groups.mark_activity(&caller.into(), timestamp);
            } else {
                state.data.local_communities.mark_activity(&caller.into(), timestamp);
            }
        }
        GroupOrCommunityEvent::MarkActivityForUser(timestamp, user_id) => {
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
        GroupOrCommunityEvent::EventStoreEvent(event) => state.data.event_store_client.push(event),
        GroupOrCommunityEvent::Notification(notification) => {
            if let Notification::Bot(bot_notification) = &*notification
                && let BotEvent::Lifecycle(BotLifecycleEvent::Installed(event)) = &bot_notification.event
            {
                state.push_event_to_user_index(
                    crate::UserIndexEvent::BotInstalled(Box::new(BotInstalled {
                        bot_id: bot_notification.recipients[0],
                        location: event.location,
                        installed_by: event.installed_by,
                        granted_permissions: event.granted_command_permissions.clone(),
                        granted_autonomous_permissions: event.granted_autonomous_permissions.clone(),
                    })),
                    **now,
                );
            }

            state.handle_notification(*notification, state.env.canister_id(), **now)
        }
    }
}
