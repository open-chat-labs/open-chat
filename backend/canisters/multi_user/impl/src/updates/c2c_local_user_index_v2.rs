use crate::guards::caller_is_local_user_index;
use crate::{RuntimeState, mutate_state, openchat_bot};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::{Achievement, DiamondMembershipPlanDuration, ReferralStatus, Timestamped};
use user_canister::LocalUserIndexEvent;
use user_canister::c2c_local_user_index_v2::*;
use user_canister::mark_read::ChannelMessagesRead;

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_local_user_index_v2(args: Args) -> Response {
    mutate_state(|state| c2c_local_user_index_v2_impl(args, state))
}

// Applies the events to the users they are for, in order
fn c2c_local_user_index_v2_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();

    for event in args.events {
        if !state
            .data
            .idempotency_checker
            .check(caller, event.created_at, event.idempotency_id)
        {
            continue;
        }
        let (user_id, event) = event.value;
        // Events for a user who isn't in this canister can never be applied, so are dropped rather
        // than failing the batch, which the LocalUserIndex would otherwise retry
        if let Some(user_index) = state.index_of_local_user(user_id) {
            process_event(user_index, event, state);
        }
    }
    Response::Success
}

// Applies an event to the user at `user_index`, as the User canister does for its user
fn process_event(user_index: u16, event: LocalUserIndexEvent, state: &mut RuntimeState) {
    let now = state.env.now();

    match event {
        LocalUserIndexEvent::UsernameChanged(ev) => {
            state
                .data
                .users
                .with_user_mut(user_index, |user| user.username = Timestamped::new(ev.username, now));
        }
        LocalUserIndexEvent::DisplayNameChanged(ev) => {
            state
                .data
                .users
                .with_user_mut(user_index, |user| user.display_name = Timestamped::new(ev.display_name, now));
            state.award_achievement_and_notify(user_index, Achievement::SetDisplayName, now);
        }
        LocalUserIndexEvent::UserSuspended(ev) => {
            openchat_bot::send_user_suspended_message(user_index, &ev, state);
        }
        LocalUserIndexEvent::UserJoinedGroup(ev) => {
            let joined = state
                .data
                .users
                .with_user_mut(user_index, |user| {
                    // Check that the user didn't already leave the group before this event arrived
                    if user
                        .group_chats
                        .removed_since(ev.group_canister_timestamp)
                        .contains(&ev.chat_id)
                    {
                        false
                    } else {
                        user.group_chats
                            .join(ev.chat_id, ev.local_user_index_canister_id, ev.latest_message_index, now);
                        user.hot_group_exclusions.remove(&ev.chat_id, now);
                        true
                    }
                })
                .unwrap_or_default();

            if joined {
                state.award_achievement_and_notify(user_index, Achievement::JoinedGroup, now);
            }
        }
        LocalUserIndexEvent::UserJoinedCommunityOrChannel(ev) => {
            let joined = state
                .data
                .users
                .with_user_mut(user_index, |user| {
                    // Check that the user didn't already leave the community before this event arrived
                    if user
                        .communities
                        .removed_since(ev.community_canister_timestamp)
                        .contains(&ev.community_id)
                    {
                        false
                    } else {
                        let (community, _) = user.communities.join(ev.community_id, ev.local_user_index_canister_id, now);
                        community.mark_read(
                            ev.channels
                                .into_iter()
                                .map(|c| ChannelMessagesRead {
                                    channel_id: c.channel_id,
                                    read_up_to: c.latest_message_index,
                                    threads: Vec::new(),
                                    date_read_pinned: None,
                                })
                                .collect(),
                            now,
                        );
                        true
                    }
                })
                .unwrap_or_default();

            if joined {
                state.award_achievement_and_notify(user_index, Achievement::JoinedCommunity, now);
            }
        }
        LocalUserIndexEvent::DiamondMembershipPaymentReceived(ev) => {
            let mut achievements = vec![Achievement::UpgradedToDiamond];
            if matches!(ev.duration, DiamondMembershipPlanDuration::Lifetime) {
                achievements.push(Achievement::UpgradedToGoldDiamond);
            }
            state.award_achievements_and_notify(user_index, achievements, now);

            state
                .data
                .users
                .with_user_mut(user_index, |user| user.diamond_membership_expires_at = Some(ev.expires_at));

            if ev.send_bot_message {
                openchat_bot::send_text_message(
                    user_index,
                    user_core::openchat_bot::DIAMOND_MEMBERSHIP_PAYMENT_RECEIVED_TEXT.to_string(),
                    Vec::new(),
                    false,
                    state,
                );
            }

            let status = if matches!(ev.duration, DiamondMembershipPlanDuration::Lifetime) {
                ReferralStatus::LifetimeDiamond
            } else {
                ReferralStatus::Diamond
            };
            state.set_referral_status_of_referrer(user_index, status, now);
        }
        LocalUserIndexEvent::PhoneNumberConfirmed(ev) => {
            state.data.users.with_user_mut(user_index, |user| {
                user.phone_is_verified = true;
                user.storage_limit = ev.new_storage_limit;
            });
            openchat_bot::send_phone_number_confirmed_bot_message(user_index, &ev, state);
        }
        LocalUserIndexEvent::StorageUpgraded(ev) => {
            state.data.users.with_user_mut(user_index, |user| {
                user.storage_limit = ev.new_storage_limit;
            });
            openchat_bot::send_storage_ugraded_bot_message(user_index, &ev, state);
        }
        LocalUserIndexEvent::ReferredUserRegistered(ev) => {
            state.data.users.with_user_mut(user_index, |user| {
                user.referrals.set_status(ev.user_id, ReferralStatus::Registered, now);
            });
            openchat_bot::send_referred_user_joined_message(user_index, ev.user_id, ev.username, state);
        }
        LocalUserIndexEvent::OpenChatBotMessageV2(message) => {
            openchat_bot::send_message(user_index, message.content.into(), message.mentioned, false, state);
        }
        LocalUserIndexEvent::NotifyUniquePersonProof(proof) => {
            state.award_achievement_and_notify(user_index, Achievement::ProvedUniquePersonhood, now);
            state.data.users.with_user_mut(user_index, |user| {
                user.unique_person_proof = Some(*proof);
            });
            state.set_referral_status_of_referrer(user_index, ReferralStatus::UniquePerson, now);
        }
        LocalUserIndexEvent::ExternalAchievementAwarded(ev) => {
            let awarded = state
                .data
                .users
                .with_user_mut(user_index, |user| {
                    user.award_external_achievement(ev.name, ev.chit_reward, now)
                })
                .unwrap_or_default();
            if awarded {
                state.notify_user_index_of_chit(user_index, now);
            }
        }
        LocalUserIndexEvent::ReinstateMissedDailyClaims(days) => state.reinstate_missed_daily_claims(user_index, days),
        // TODO: Handle these once the MultiUser canister holds each user's bots. Until then a user
        // has none, so there is nothing to update.
        LocalUserIndexEvent::BotUpdated(_) | LocalUserIndexEvent::BotRemoved(_) => {}
    }
}
