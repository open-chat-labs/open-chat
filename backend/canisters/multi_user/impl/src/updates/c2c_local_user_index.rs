use crate::guards::caller_is_local_user_index;
use crate::{RuntimeState, mutate_state, openchat_bot};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::{Achievement, DiamondMembershipPlanDuration, ReferralStatus, Timestamped};
use user_canister::LocalUserIndexEvent;
use user_canister::c2c_local_user_index::*;

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_local_user_index(args: Args) -> Response {
    mutate_state(|state| c2c_local_user_index_impl(args, state))
}

fn c2c_local_user_index_impl(args: Args, state: &mut RuntimeState) -> Response {
    // Every event is for a single user of this canister, but the idempotency checker is shared,
    // since each event id is unique across the events the LocalUserIndex sends
    let Some(user_index) = state.user_index(args.user_id) else {
        // The events of a user this canister doesn't hold are dropped rather than retried forever
        return Response::Success;
    };

    for event in args.events {
        if state.data.idempotency_checker.check(
            state.data.local_user_index_canister_id,
            event.created_at,
            event.idempotency_id,
        ) {
            process_event(user_index, event.value, state);
        }
    }
    Response::Success
}

fn process_event(user_index: u16, event: LocalUserIndexEvent, state: &mut RuntimeState) {
    let now = state.env.now();

    match event {
        LocalUserIndexEvent::UsernameChanged(ev) => {
            state.data.users.with_user_mut(user_index, |user| {
                user.username = Timestamped::new(ev.username, now);
            });
        }
        LocalUserIndexEvent::DisplayNameChanged(ev) => {
            state.data.users.with_user_mut(user_index, |user| {
                user.display_name = Timestamped::new(ev.display_name, now);
            });
            state.award_achievement_and_notify(user_index, Achievement::SetDisplayName, now);
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
        LocalUserIndexEvent::UserSuspended(ev) => {
            openchat_bot::send_user_suspended_message(user_index, &ev, state);
        }
        LocalUserIndexEvent::OpenChatBotMessageV2(message) => {
            openchat_bot::send_message(user_index, message.content.into(), message.mentioned, false, state);
        }
        LocalUserIndexEvent::DiamondMembershipPaymentReceived(ev) => {
            let mut achievements = vec![Achievement::UpgradedToDiamond];
            if matches!(ev.duration, DiamondMembershipPlanDuration::Lifetime) {
                achievements.push(Achievement::UpgradedToGoldDiamond);
            }
            state.award_achievements_and_notify(user_index, achievements, now);

            state.data.users.with_user_mut(user_index, |user| {
                user.diamond_membership_expires_at = Some(ev.expires_at);
            });

            if ev.send_bot_message {
                openchat_bot::send_text_message(
                    user_index,
                    "Payment received for Diamond membership!".to_string(),
                    Vec::new(),
                    false,
                    state,
                );
            }

            // TODO: Tell the referrer's canister of the user's new referral status, once the
            // MultiUser canister sends events to other user canisters
        }
        LocalUserIndexEvent::NotifyUniquePersonProof(proof) => {
            state.award_achievement_and_notify(user_index, Achievement::ProvedUniquePersonhood, now);
            state.data.users.with_user_mut(user_index, |user| {
                user.unique_person_proof = Some(*proof);
            });

            // TODO: Tell the referrer's canister of the user's new referral status, as above
        }
        LocalUserIndexEvent::ExternalAchievementAwarded(ev) => {
            state.award_external_achievement(user_index, ev.name, ev.chit_reward, now);
        }
        LocalUserIndexEvent::ReinstateMissedDailyClaims(days) => state.reinstate_missed_daily_claims(user_index, days),
        // TODO: Handle these once the MultiUser canister holds each user's groups, communities and
        // bots. Until then a user has none, so there is nothing to update.
        LocalUserIndexEvent::UserJoinedGroup(_)
        | LocalUserIndexEvent::UserJoinedCommunityOrChannel(_)
        | LocalUserIndexEvent::BotRemoved(_)
        | LocalUserIndexEvent::BotUpdated(_) => {}
    }
}
