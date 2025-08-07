use crate::guards::caller_is_user_index;
use crate::{RuntimeState, UserEvent, UserToDelete, jobs, mutate_state};
use canister_api_macros::update;
use canister_time::now_millis;
use canister_tracing_macros::trace;
use constants::OPENCHAT_BOT_USER_ID;
use local_user_index_canister::c2c_notify_user_index_events::*;
use local_user_index_canister::{UserIndexEvent, UserRegistered};
use msgpack::serialize_then_unwrap;
use p256_key_pair::P256KeyPair;
use stable_memory_map::StableMemoryMap;
use std::cell::LazyCell;
use std::cmp::min;
use tracing::info;
use types::{BotEvent, BotLifecycleEvent, BotNotification, BotRegisteredEvent, TimestampMillis, c2c_uninstall_bot};
use user_canister::{
    DiamondMembershipPaymentReceived, DisplayNameChanged, ExternalAchievementAwarded, OpenChatBotMessageV2,
    PhoneNumberConfirmed, ReferredUserRegistered, StorageUpgraded, UserJoinedCommunityOrChannel, UserJoinedGroup,
    UserSuspended, UsernameChanged,
};

#[update(guard = "caller_is_user_index", msgpack = true)]
#[trace]
fn c2c_notify_user_index_events(args: Args) -> Response {
    mutate_state(|state| c2c_notify_user_index_events_impl(args, state))
}

fn c2c_notify_user_index_events_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = LazyCell::new(now_millis);
    for event in args.events {
        handle_event(event, &now, state);
    }
    Response::Success
}

fn handle_event<F: FnOnce() -> TimestampMillis>(
    event: UserIndexEvent,
    now: &LazyCell<TimestampMillis, F>,
    state: &mut RuntimeState,
) {
    match event {
        UserIndexEvent::UsernameChanged(ev) => {
            state.push_event_to_user(
                ev.user_id,
                UserEvent::UsernameChanged(Box::new(UsernameChanged { username: ev.username })),
                **now,
            );
        }
        UserIndexEvent::DisplayNameChanged(ev) => {
            state.push_event_to_user(
                ev.user_id,
                UserEvent::DisplayNameChanged(Box::new(DisplayNameChanged {
                    display_name: ev.display_name,
                })),
                **now,
            );
        }
        UserIndexEvent::UserSuspended(ev) => {
            state.push_event_to_user(
                ev.user_id,
                UserEvent::UserSuspended(Box::new(UserSuspended {
                    timestamp: ev.timestamp,
                    duration: ev.duration,
                    reason: ev.reason,
                    suspended_by: ev.suspended_by,
                })),
                **now,
            );
        }
        UserIndexEvent::PhoneNumberConfirmed(ev) => {
            state.push_event_to_user(
                ev.user_id,
                UserEvent::PhoneNumberConfirmed(Box::new(PhoneNumberConfirmed {
                    phone_number: ev.phone_number,
                    storage_added: ev.storage_added,
                    new_storage_limit: ev.new_storage_limit,
                })),
                **now,
            );
        }
        UserIndexEvent::StorageUpgraded(ev) => {
            state.push_event_to_user(
                ev.user_id,
                UserEvent::StorageUpgraded(Box::new(StorageUpgraded {
                    cost: ev.cost,
                    storage_added: ev.storage_added,
                    new_storage_limit: ev.new_storage_limit,
                })),
                **now,
            );
        }
        UserIndexEvent::UserRegistered(ev) => handle_user_registered(ev, **now, state),
        UserIndexEvent::BotRegistered(ev) => {
            state.data.bots.add(
                ev.user_principal,
                ev.bot_id,
                ev.owner_id,
                ev.name.clone(),
                ev.commands,
                ev.endpoint,
                ev.autonomous_config,
                ev.default_subscriptions,
                ev.permitted_install_location,
                ev.data_encoding,
            );

            let this_canister_id = state.env.canister_id();
            if ev.notification_canister == this_canister_id {
                // This local_user_index canister has been nominated to notify the bot
                state.data.push_bot_notification(
                    BotNotification {
                        event: BotEvent::Lifecycle(BotLifecycleEvent::Registered(BotRegisteredEvent {
                            bot_id: ev.bot_id,
                            bot_name: ev.name,
                        })),
                        recipients: vec![ev.bot_id],
                        timestamp: **now,
                    },
                    this_canister_id,
                    **now,
                );
            }
        }
        UserIndexEvent::BotPublished(ev) => {
            state.data.bots.publish(ev.bot_id);
        }
        UserIndexEvent::BotUpdated(ev) => {
            state.data.bots.update(ev.bot_id, ev.owner_id, ev.endpoint, ev.definition);
        }
        UserIndexEvent::PlatformOperatorStatusChanged(ev) => {
            state
                .data
                .global_users
                .set_platform_operator(ev.user_id, ev.is_platform_operator);
        }
        UserIndexEvent::PlatformModeratorStatusChanged(ev) => {
            state
                .data
                .global_users
                .set_platform_moderator(ev.user_id, ev.is_platform_moderator);
        }
        UserIndexEvent::MaxConcurrentCanisterUpgradesChanged(ev) => {
            state.data.max_concurrent_user_upgrades = ev.value;
            info!("Max concurrent canister upgrades set to {}", ev.value);
        }
        UserIndexEvent::UserUpgradeConcurrencyChanged(ev) => {
            state.data.user_upgrade_concurrency = min(state.data.max_concurrent_user_upgrades, ev.value);
            if state.data.user_upgrade_concurrency > 0 {
                jobs::upgrade_users::start_job_if_required(state);
            }
            info!("User upgrade concurrency set to {}", ev.value);
        }
        UserIndexEvent::UserJoinedGroup(ev) => {
            state.push_event_to_user(
                ev.user_id,
                UserEvent::UserJoinedGroup(Box::new(UserJoinedGroup {
                    chat_id: ev.chat_id,
                    local_user_index_canister_id: ev.local_user_index_canister_id,
                    latest_message_index: ev.latest_message_index,
                    group_canister_timestamp: ev.group_canister_timestamp,
                })),
                **now,
            );
        }
        UserIndexEvent::UserJoinedCommunityOrChannel(ev) => {
            state.push_event_to_user(
                ev.user_id,
                UserEvent::UserJoinedCommunityOrChannel(Box::new(UserJoinedCommunityOrChannel {
                    community_id: ev.community_id,
                    local_user_index_canister_id: ev.local_user_index_canister_id,
                    channels: ev.channels,
                    community_canister_timestamp: ev.community_canister_timestamp,
                })),
                **now,
            );
        }
        UserIndexEvent::DiamondMembershipPaymentReceived(ev) => {
            state
                .data
                .global_users
                .set_diamond_membership_expiry_date(ev.user_id, ev.expires_at);

            if state.data.local_users.contains(&ev.user_id) {
                state.push_event_to_user(
                    ev.user_id,
                    UserEvent::DiamondMembershipPaymentReceived(Box::new(DiamondMembershipPaymentReceived {
                        timestamp: ev.timestamp,
                        expires_at: ev.expires_at,
                        ledger: ev.ledger,
                        token: Some(ev.token_symbol.clone().into()),
                        token_symbol: ev.token_symbol,
                        amount_e8s: ev.amount_e8s,
                        block_index: ev.block_index,
                        duration: ev.duration,
                        recurring: ev.recurring,
                        send_bot_message: ev.send_bot_message,
                    })),
                    **now,
                );
            }
        }
        UserIndexEvent::OpenChatBotMessage(ev) => {
            state.push_event_to_user(ev.user_id, UserEvent::OpenChatBotMessage(Box::new(ev.message)), **now);
        }
        UserIndexEvent::OpenChatBotMessageV2(ev) => {
            state.push_event_to_user(
                ev.user_id,
                UserEvent::OpenChatBotMessageV2(Box::new(OpenChatBotMessageV2 {
                    thread_root_message_id: ev.thread_root_message_id,
                    content: ev.content,
                    mentioned: ev.mentioned,
                })),
                **now,
            );
        }
        UserIndexEvent::ReferralCodeAdded(ev) => {
            state.data.referral_codes.add(ev.referral_type, ev.code, ev.expiry, **now);
        }
        UserIndexEvent::UserPrincipalUpdated(update) => {
            state
                .data
                .global_users
                .update_user_principal(update.old_principal, update.new_principal);
        }
        UserIndexEvent::BotRemoved(ev) => {
            state.data.bots.remove(&ev.user_id);
        }
        UserIndexEvent::DeleteUser(ev) => {
            if state.data.local_users.contains(&ev.user_id) {
                state.data.users_to_delete_queue.push_back(UserToDelete {
                    user_id: ev.user_id,
                    triggered_by_user: ev.triggered_by_user,
                    attempt: 0,
                });
                jobs::delete_users::start_job_if_required(state, None);
            } else {
                state.data.global_users.remove(&ev.user_id);
            }
        }
        UserIndexEvent::SecretKeySet(sk_der) => {
            if let Ok(key_pair) = P256KeyPair::from_secret_key_der(sk_der) {
                state.data.oc_key_pair = key_pair;
            }
        }
        UserIndexEvent::NotifyUniquePersonProof(user_id, proof) => {
            if state.data.local_users.contains(&user_id) {
                state.push_event_to_user(user_id, UserEvent::NotifyUniquePersonProof(Box::new(proof.clone())), **now);
            }
            state.data.global_users.insert_unique_person_proof(user_id, proof);
        }
        UserIndexEvent::UpdateChitBalance(user_id, chit_record) => {
            state.data.global_users.insert_chit_record(user_id, chit_record);
        }
        UserIndexEvent::AddCanisterToPool(canister_id) => {
            if !state.data.canister_pool.contains(&canister_id) {
                state.data.canister_pool.push(canister_id);
            }
        }
        UserIndexEvent::ExternalAchievementAwarded(ev) => {
            state.push_event_to_user(
                ev.user_id,
                UserEvent::ExternalAchievementAwarded(Box::new(ExternalAchievementAwarded {
                    name: ev.name,
                    chit_reward: ev.chit_reward,
                })),
                **now,
            );
        }
        UserIndexEvent::SyncExistingUser(user) => {
            handle_user_registered(
                UserRegistered {
                    user_id: user.user_id,
                    user_principal: user.user_principal,
                    username: user.username,
                    user_type: user.user_type,
                    referred_by: user.referred_by,
                },
                **now,
                state,
            );

            if user.is_platform_moderator {
                state.data.global_users.set_platform_moderator(user.user_id, true);
            }
            if user.is_platform_operator {
                state.data.global_users.set_platform_operator(user.user_id, true);
            }
            if let Some(expires_at) = user.diamond_membership_expires_at {
                state
                    .data
                    .global_users
                    .set_diamond_membership_expiry_date(user.user_id, expires_at);
            }
            if let Some(proof) = user.unique_person_proof {
                state.data.global_users.insert_unique_person_proof(user.user_id, proof);
            }
        }
        UserIndexEvent::BotUninstall(ev) => {
            state.data.fire_and_forget_handler.send(
                ev.location.canister_id(),
                "c2c_uninstall_bot_msgpack".to_string(),
                serialize_then_unwrap(&c2c_uninstall_bot::Args {
                    bot_id: ev.bot_id,
                    caller: OPENCHAT_BOT_USER_ID,
                }),
            );
        }
        UserIndexEvent::UserBlocked(user_id, blocked) => {
            state.data.blocked_users.insert((blocked, user_id), ());
        }
        UserIndexEvent::UserUnblocked(user_id, unblocked) => {
            state.data.blocked_users.remove(&(unblocked, user_id));
        }
    }
}

fn handle_user_registered(user: UserRegistered, now: TimestampMillis, state: &mut RuntimeState) {
    state.data.global_users.add(user.user_principal, user.user_id, user.user_type);

    if let Some(referred_by) = user.referred_by {
        if state.data.local_users.get(&referred_by).is_some() {
            state.push_event_to_user(
                referred_by,
                UserEvent::ReferredUserRegistered(Box::new(ReferredUserRegistered {
                    user_id: user.user_id,
                    username: user.username,
                })),
                now,
            );
        }
    }
}
