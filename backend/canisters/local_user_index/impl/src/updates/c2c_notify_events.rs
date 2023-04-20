use std::cmp::min;

use crate::guards::caller_is_user_index_canister;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use local_user_index_canister::c2c_notify_events::{Response::*, *};
use local_user_index_canister::Event;
use tracing::info;
use user_canister::{
    DiamondMembershipPaymentReceived, Event as UserEvent, PhoneNumberConfirmed, ReferredUserRegistered, StorageUpgraded,
    UserJoinedGroup, UserSuspended, UsernameChanged,
};

#[update_msgpack(guard = "caller_is_user_index_canister")]
#[trace]
fn c2c_notify_events(args: Args) -> Response {
    mutate_state(|state| c2c_notify_user_index_events_impl(args, state))
}

#[update_msgpack(guard = "caller_is_user_index_canister")]
#[trace]
fn c2c_notify_user_index_events(args: Args) -> Response {
    mutate_state(|state| c2c_notify_user_index_events_impl(args, state))
}

fn c2c_notify_user_index_events_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    for event in args.events {
        handle_event(event, runtime_state);
    }
    Success
}

fn handle_event(event: Event, runtime_state: &mut RuntimeState) {
    match event {
        Event::UsernameChanged(ev) => {
            runtime_state.push_event_to_user(
                ev.user_id,
                UserEvent::UsernameChanged(Box::new(UsernameChanged { username: ev.username })),
            );
        }
        Event::UserSuspended(ev) => {
            runtime_state.push_event_to_user(
                ev.user_id,
                UserEvent::UserSuspended(Box::new(UserSuspended {
                    timestamp: ev.timestamp,
                    duration: ev.duration,
                    reason: ev.reason,
                    suspended_by: ev.suspended_by,
                })),
            );
        }
        Event::PhoneNumberConfirmed(ev) => {
            runtime_state.push_event_to_user(
                ev.user_id,
                UserEvent::PhoneNumberConfirmed(Box::new(PhoneNumberConfirmed {
                    phone_number: ev.phone_number,
                    storage_added: ev.storage_added,
                    new_storage_limit: ev.new_storage_limit,
                })),
            );
        }
        Event::StorageUpgraded(ev) => {
            runtime_state.push_event_to_user(
                ev.user_id,
                UserEvent::StorageUpgraded(Box::new(StorageUpgraded {
                    cost: ev.cost,
                    storage_added: ev.storage_added,
                    new_storage_limit: ev.new_storage_limit,
                })),
            );
        }
        Event::UserRegistered(ev) => {
            runtime_state.data.global_users.add(ev.user_principal, ev.user_id, ev.is_bot);

            if let Some(referred_by) = ev.referred_by {
                if runtime_state.data.local_users.get(&referred_by).is_some() {
                    runtime_state.push_event_to_user(
                        referred_by,
                        UserEvent::ReferredUserRegistered(Box::new(ReferredUserRegistered {
                            user_id: ev.user_id,
                            username: ev.username,
                        })),
                    );
                }
            }
        }
        Event::SuperAdminStatusChanged(ev) => {
            runtime_state
                .data
                .global_users
                .set_platform_moderator(ev.user_id, ev.is_super_admin);
        }
        Event::MaxConcurrentCanisterUpgradesChanged(ev) => {
            runtime_state.data.max_concurrent_canister_upgrades = ev.value;
            info!("Max concurrent canister upgrades set to {}", ev.value);
        }
        Event::UserUpgradeConcurrencyChanged(ev) => {
            runtime_state.data.user_upgrade_concurrency = min(runtime_state.data.max_concurrent_canister_upgrades, ev.value);
            info!("User upgrade concurrency set to {}", ev.value);
        }
        Event::UserJoinedGroup(ev) => {
            runtime_state.push_event_to_user(
                ev.user_id,
                UserEvent::UserJoinedGroup(Box::new(UserJoinedGroup {
                    chat_id: ev.chat_id,
                    latest_message_index: ev.latest_message_index,
                })),
            );
        }
        Event::DiamondMembershipPaymentReceived(ev) => {
            runtime_state.push_event_to_user(
                ev.user_id,
                UserEvent::DiamondMembershipPaymentReceived(Box::new(DiamondMembershipPaymentReceived {
                    timestamp: ev.timestamp,
                    expires_at: ev.expires_at,
                    token: ev.token,
                    amount_e8s: ev.amount_e8s,
                    block_index: ev.block_index,
                    duration: ev.duration,
                    recurring: ev.recurring,
                    send_bot_message: ev.send_bot_message,
                })),
            );
        }
        Event::OpenChatBotMessage(ev) => {
            runtime_state.push_event_to_user(ev.user_id, UserEvent::OpenChatBotMessage(Box::new(ev.message)));
        }
    }
}
