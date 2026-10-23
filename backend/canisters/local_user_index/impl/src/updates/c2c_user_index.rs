use crate::guards::caller_is_user_index;
use crate::{CommunityEvent, GroupEvent, RuntimeState, UserEvent, UserToDelete, jobs, mutate_state};
use canister_api_macros::update;
use canister_time::now_millis;
use canister_tracing_macros::trace;
use local_user_index_canister::c2c_user_index::*;
use local_user_index_canister::{UserIndexEvent, UserRegistered};
use multi_user_canister::{
    DiamondMembershipPaymentReceived, DisplayNameChanged, ExternalAchievementAwarded, OpenChatBotMessageV2,
    PhoneNumberConfirmed, ReferredUserRegistered, StorageUpgraded, UserJoinedCommunityOrChannel, UserJoinedGroup,
    UserSuspended, UsernameChanged,
};
use p256_key_pair::P256KeyPair;
use stable_memory_map::StableMemoryMap;
use std::cell::LazyCell;
use types::{
    BotEvent, BotInstallationLocation, BotLifecycleEvent, BotNotification, BotRegisteredEvent, PushIfNotContains,
    TimestampMillis,
};

#[update(guard = "caller_is_user_index", msgpack = true)]
#[trace]
fn c2c_user_index(args: Args) -> Response {
    mutate_state(|state| c2c_user_index_impl(args, state))
}

fn c2c_user_index_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = LazyCell::new(now_millis);
    for event in args.events {
        if state
            .data
            .idempotency_checker
            .check(state.data.user_index_canister_id, event.created_at, event.idempotency_id)
        {
            handle_event(event.value, &now, state);
        }
    }
    Response::Success
}

pub(crate) fn handle_event<F: FnOnce() -> TimestampMillis>(
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
                state.push_bot_notification(
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
            if let Some(principal) = ev.principal {
                state.data.global_users.update_principal(ev.bot_id, principal);
            }
            state
                .data
                .bots
                .update(ev.bot_id, ev.owner_id, ev.endpoint, ev.definition, ev.principal);
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
        UserIndexEvent::BotRemoved(ev) => {
            state.data.bots.remove(&ev.user_id);
        }
        UserIndexEvent::DeleteUser(ev) => {
            if state.data.local_users.contains(&ev.user_id) {
                state.data.users_to_delete_queue.push_back(UserToDelete {
                    user_id: ev.user_id,
                    #[allow(deprecated)]
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
            state.push_event_to_user(user_id, UserEvent::NotifyUniquePersonProof(Box::new(proof.clone())), **now);
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
        UserIndexEvent::BotUninstall(location, bot_id) => match location {
            BotInstallationLocation::Community(community_id) => {
                state.push_event_to_community(community_id.into(), CommunityEvent::BotRemoved(bot_id), **now);
            }
            BotInstallationLocation::Group(group_id) => {
                state.push_event_to_group(group_id.into(), GroupEvent::BotRemoved(bot_id), **now);
            }
            BotInstallationLocation::User(user_id) => {
                state.push_event_to_user(user_id.into(), UserEvent::BotRemoved(bot_id), **now);
            }
        },
        UserIndexEvent::BotUpdateInstallation(location, ev) => match location {
            BotInstallationLocation::Community(community_id) => {
                state.push_event_to_community(community_id.into(), CommunityEvent::BotUpdated(ev), **now);
            }
            BotInstallationLocation::Group(group_id) => {
                state.push_event_to_group(group_id.into(), GroupEvent::BotUpdated(ev), **now);
            }
            BotInstallationLocation::User(user_id) => {
                state.push_event_to_user(user_id.into(), UserEvent::BotUpdated(Box::new(ev)), **now);
            }
        },
        UserIndexEvent::UserBlocked(user_id, blocked) => {
            state.data.blocked_users.insert((blocked, user_id), ());
        }
        UserIndexEvent::UserUnblocked(user_id, unblocked) => {
            state.data.blocked_users.remove(&(unblocked, user_id));
        }
        UserIndexEvent::SetPremiumItemCost(ev) => state.data.premium_items.set(ev.item_id, ev.chit_cost),
        UserIndexEvent::UpdateBlockedUsernamePatterns(ev) => {
            if ev.add {
                state.data.blocked_username_patterns.push_if_not_contains(ev.pattern);
            } else {
                state.data.blocked_username_patterns.retain(|p| *p != ev.pattern);
            }
        }
        UserIndexEvent::SetOpenAIApiKey(ev) => {
            state.data.openai_api_key = ev.api_key.clone();
            crate::jobs::moderate_messages::start_job_if_required(state);
        }
        UserIndexEvent::SetModerationReferralConfig(ev) => {
            state.data.moderation_referral_config = ev.config;
        }
        UserIndexEvent::SetMediaScanConfig(config) => {
            state.data.media_scan_config = config;
        }
        UserIndexEvent::SetCallPushEnabled(enabled) => {
            state.data.call_push_enabled = enabled;
        }
        UserIndexEvent::SetDailyPuzzleCanisterId(canister_id) => {
            state.set_daily_puzzle_canister_id(canister_id);
        }
        UserIndexEvent::SetBridgeBot(ev) => {
            if let Some(bot_id) = ev.bot_id {
                state.data.bridge_bots.insert(ev.platform, bot_id);
            } else {
                state.data.bridge_bots.remove(&ev.platform);
            }
        }
        UserIndexEvent::BridgedUserLinked(ev) => {
            if let Some(user_id) = ev.linked_user_id {
                state.data.bridged_user_links.insert(ev.user, user_id);
            } else {
                state.data.bridged_user_links.remove(&ev.user);
            }
        }
        // Seeds a LocalUserIndex added after users were migrated with their old ids
        UserIndexEvent::UserIdMigrated(ev) => {
            state.data.migrated_user_ids.insert(ev.old_user_id, ev.new_user_id);
        }
        // Passed on to every MultiUser canister. One created later is given the key in its init args.
        UserIndexEvent::SetAlchemyApiKey(ev) => {
            state.data.alchemy_api_key = ev.api_key.clone();
            let canister_ids: Vec<_> = state.data.local_multi_user_canisters.iter().map(|(c, _)| *c).collect();
            for canister_id in canister_ids {
                state.push_event_to_multi_user_canister(
                    canister_id,
                    UserEvent::SetAlchemyApiKey(multi_user_canister::SetAlchemyApiKey {
                        api_key: ev.api_key.clone(),
                    }),
                    **now,
                );
            }
        }
    }
}

fn handle_user_registered(user: UserRegistered, now: TimestampMillis, state: &mut RuntimeState) {
    state.data.global_users.add(user.user_principal, user.user_id, user.user_type);

    if let Some(referred_by) = user.referred_by {
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
