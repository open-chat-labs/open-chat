use crate::guards::caller_is_user_index_canister;
use crate::{jobs, mutate_state, RuntimeState, UserToDelete};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::c2c_notify_user_index_events::{Response::*, *};
use local_user_index_canister::Event;
use p256_key_pair::P256KeyPair;
use std::cmp::min;
use tracing::info;
use user_canister::{
    DiamondMembershipPaymentReceived, DisplayNameChanged, Event as UserEvent, ExternalAchievementAwarded, OpenChatBotMessageV2,
    PhoneNumberConfirmed, ReferredUserRegistered, StorageUpgraded, UserJoinedCommunityOrChannel, UserJoinedGroup,
    UserSuspended, UsernameChanged,
};

#[update(guard = "caller_is_user_index_canister", msgpack = true)]
#[trace]
fn c2c_notify_user_index_events(args: Args) -> Response {
    mutate_state(|state| c2c_notify_user_index_events_impl(args, state))
}

fn c2c_notify_user_index_events_impl(args: Args, state: &mut RuntimeState) -> Response {
    for event in args.events {
        handle_event(event, state);
    }
    Success
}

fn handle_event(event: Event, state: &mut RuntimeState) {
    match event {
        Event::UsernameChanged(ev) => {
            state.push_event_to_user(
                ev.user_id,
                UserEvent::UsernameChanged(Box::new(UsernameChanged { username: ev.username })),
            );
        }
        Event::DisplayNameChanged(ev) => {
            state.push_event_to_user(
                ev.user_id,
                UserEvent::DisplayNameChanged(Box::new(DisplayNameChanged {
                    display_name: ev.display_name,
                })),
            );
        }
        Event::UserSuspended(ev) => {
            state.push_event_to_user(
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
            state.push_event_to_user(
                ev.user_id,
                UserEvent::PhoneNumberConfirmed(Box::new(PhoneNumberConfirmed {
                    phone_number: ev.phone_number,
                    storage_added: ev.storage_added,
                    new_storage_limit: ev.new_storage_limit,
                })),
            );
        }
        Event::StorageUpgraded(ev) => {
            state.push_event_to_user(
                ev.user_id,
                UserEvent::StorageUpgraded(Box::new(StorageUpgraded {
                    cost: ev.cost,
                    storage_added: ev.storage_added,
                    new_storage_limit: ev.new_storage_limit,
                })),
            );
        }
        Event::UserRegistered(ev) => {
            state.data.global_users.add(ev.user_principal, ev.user_id, ev.user_type);

            if let Some(referred_by) = ev.referred_by {
                if state.data.local_users.get(&referred_by).is_some() {
                    state.push_event_to_user(
                        referred_by,
                        UserEvent::ReferredUserRegistered(Box::new(ReferredUserRegistered {
                            user_id: ev.user_id,
                            username: ev.username,
                        })),
                    );
                }
            }
        }
        Event::BotRegistered(ev) => {
            state.data.bots.set(ev.user_principal, ev.user_id, ev.name, ev.commands);
        }
        Event::SuperAdminStatusChanged(ev) => {
            state.data.global_users.set_platform_moderator(ev.user_id, ev.is_super_admin);
        }
        Event::MaxConcurrentCanisterUpgradesChanged(ev) => {
            state.data.max_concurrent_canister_upgrades = ev.value;
            info!("Max concurrent canister upgrades set to {}", ev.value);
        }
        Event::UserUpgradeConcurrencyChanged(ev) => {
            state.data.user_upgrade_concurrency = min(state.data.max_concurrent_canister_upgrades, ev.value);
            if state.data.user_upgrade_concurrency > 0 {
                jobs::upgrade_canisters::start_job_if_required(state);
            }
            info!("User upgrade concurrency set to {}", ev.value);
        }
        Event::UserJoinedGroup(ev) => {
            state.push_event_to_user(
                ev.user_id,
                UserEvent::UserJoinedGroup(Box::new(UserJoinedGroup {
                    chat_id: ev.chat_id,
                    local_user_index_canister_id: ev.local_user_index_canister_id,
                    latest_message_index: ev.latest_message_index,
                    group_canister_timestamp: ev.group_canister_timestamp,
                })),
            );
        }
        Event::UserJoinedCommunityOrChannel(ev) => {
            state.push_event_to_user(
                ev.user_id,
                UserEvent::UserJoinedCommunityOrChannel(Box::new(UserJoinedCommunityOrChannel {
                    community_id: ev.community_id,
                    local_user_index_canister_id: ev.local_user_index_canister_id,
                    channels: ev.channels,
                    community_canister_timestamp: ev.community_canister_timestamp,
                })),
            );
        }
        Event::DiamondMembershipPaymentReceived(ev) => {
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
                        token: ev.token,
                        amount_e8s: ev.amount_e8s,
                        block_index: ev.block_index,
                        duration: ev.duration,
                        recurring: ev.recurring,
                        send_bot_message: ev.send_bot_message,
                    })),
                );
            }
        }
        Event::OpenChatBotMessage(ev) => {
            state.push_event_to_user(ev.user_id, UserEvent::OpenChatBotMessage(Box::new(ev.message)));
        }
        Event::OpenChatBotMessageV2(ev) => {
            state.push_event_to_user(
                ev.user_id,
                UserEvent::OpenChatBotMessageV2(Box::new(OpenChatBotMessageV2 {
                    thread_root_message_id: ev.thread_root_message_id,
                    content: ev.content,
                    mentioned: ev.mentioned,
                })),
            );
        }
        Event::ReferralCodeAdded(ev) => {
            state
                .data
                .referral_codes
                .add(ev.referral_type, ev.code, ev.expiry, state.env.now());
        }
        Event::UserPrincipalUpdated(update) => {
            state
                .data
                .global_users
                .update_user_principal(update.old_principal, update.new_principal);
        }
        Event::DeleteUser(ev) => {
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
        Event::SecretKeySet(sk_der) => {
            if let Ok(key_pair) = P256KeyPair::from_secret_key_der(sk_der) {
                state.data.oc_key_pair = key_pair;
            }
        }
        Event::NotifyUniquePersonProof(user_id, proof) => {
            if state.data.local_users.contains(&user_id) {
                state.push_event_to_user(user_id, UserEvent::NotifyUniquePersonProof(Box::new(proof.clone())))
            }
            state.data.global_users.insert_unique_person_proof(user_id, proof);
        }
        Event::AddCanisterToPool(canister_id) => {
            if !state.data.canister_pool.contains(&canister_id) {
                state.data.canister_pool.push(canister_id);
            }
        }
        Event::ExternalAchievementAwarded(ev) => {
            state.push_event_to_user(
                ev.user_id,
                UserEvent::ExternalAchievementAwarded(Box::new(ExternalAchievementAwarded {
                    name: ev.name,
                    chit_reward: ev.chit_reward,
                })),
            );
        }
    }
}
