use crate::guards::{caller_is_local_community_canister, caller_is_local_group_canister};
use crate::{CommunityEvent, GroupEvent, RuntimeState, mutate_state};
use candid::Principal;
use canister_api_macros::update;
use canister_time::now_millis;
use canister_tracing_macros::trace;
use local_user_index_canister::GroupOrCommunityEvent;
use local_user_index_canister::c2c_group_canister::*;
use std::cell::LazyCell;
use types::{BotEvent, BotLifecycleEvent, MessageClassified, Notification, TimestampMillis};
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
        GroupOrCommunityEvent::MessageClassifyRequest(request) => {
            if request.input.is_empty() {
                // Nothing classifiable (eg. an edit removed the text): dequeue any stale queued
                // content so it is never classified in the current content's place, and reply
                // with an empty classification immediately so that flags left by the earlier
                // content are cleared (flags of 0 clears them - see MessageClassified). If the
                // earlier content is in an in-flight batch rather than the queue, mark it
                // superseded so its result is discarded instead of re-applying stale flags
                // after this clear.
                state
                    .data
                    .message_moderation_queue
                    .remove(caller, request.channel_id, request.message_id);
                state.data.message_moderation_queue.mark_superseded_if_in_flight(
                    caller,
                    request.channel_id,
                    request.message_id,
                );
                let result = MessageClassified {
                    channel_id: request.channel_id,
                    thread_root_message_index: request.thread_root_message_index,
                    message_id: request.message_id,
                    flags: 0,
                    moderation_referral_flags: 0,
                };
                if is_group {
                    state.push_event_to_group(caller, GroupEvent::MessageClassified(result), **now);
                } else {
                    state.push_event_to_community(caller, CommunityEvent::MessageClassified(result), **now);
                }
            } else {
                state.data.message_moderation_queue.enqueue(caller, is_group, *request);
                crate::jobs::moderate_messages::start_job_if_required(state);
            }
        }
        GroupOrCommunityEvent::Notification(mut notification) => {
            if let Notification::Bot(bot_notification) = &mut *notification
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

                // Some bots request all their installation locations when they startup while simultaneously receiving
                // bot installation lifecycle notifications and so they will need to merge installation location
                // records from both sources, only keeping the latest. In order to do that, the timestamps must come from the
                // same canister, namely the LocalUserIndex.
                // In this case, the BotLifecycleEvent::Installed notification comes from the orginating location canister
                // so we give it the LocalUserIndex timestamp instead.
                bot_notification.timestamp = **now;
            }

            state.handle_notification(*notification, state.env.canister_id(), **now)
        }
    }
}
