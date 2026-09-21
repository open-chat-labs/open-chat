use crate::guards::caller_is_local_user_index;
use crate::{RuntimeState, mutate_state, openchat_bot};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::{Achievement, DiamondMembershipPlanDuration, Timestamped};
use user_canister::LocalUserIndexEvent;
use user_canister::c2c_local_user_index::*;
use user_canister::mark_read::ChannelMessagesRead;

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_local_user_index(args: Args) -> Response {
    mutate_state(|state| c2c_local_user_index_impl(args, state))
}

fn c2c_local_user_index_impl(args: Args, state: &mut RuntimeState) -> Response {
    // Events for a user who isn't in this canister can never be applied, so are dropped rather
    // than failing the batch, which the LocalUserIndex would otherwise retry
    let Some(user_index) = state.local_user_index(args.user_id) else {
        return Response::Success;
    };
    let caller = state.env.caller();

    for event in args.events {
        let is_new = state
            .data
            .users
            .with_user_mut(user_index, |user| {
                user.idempotency_checker.check(caller, event.created_at, event.idempotency_id)
            })
            .unwrap_or_default();

        if is_new {
            process_event(user_index, event.value, state);
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
                    "Payment received for Diamond membership!".to_string(),
                    false,
                    state,
                );
            }

            // TODO: Update the referrer's referral status, as the User canister does, once the
            // MultiUser canister can send events to other User canisters
        }
        // TODO: Handle these once the MultiUser canister holds the state they apply to (storage,
        // referrals, unique person proofs, external achievements, bots) or can send what they need
        // (OpenChat bot messages with mentions, reinstated daily claims). Until then they are
        // dropped, since failing the batch would also hold up the events above.
        LocalUserIndexEvent::PhoneNumberConfirmed(_)
        | LocalUserIndexEvent::StorageUpgraded(_)
        | LocalUserIndexEvent::ReferredUserRegistered(_)
        | LocalUserIndexEvent::OpenChatBotMessageV2(_)
        | LocalUserIndexEvent::NotifyUniquePersonProof(_)
        | LocalUserIndexEvent::ExternalAchievementAwarded(_)
        | LocalUserIndexEvent::ReinstateMissedDailyClaims(_)
        | LocalUserIndexEvent::BotUpdated(_)
        | LocalUserIndexEvent::BotRemoved(_) => {}
    }
}
