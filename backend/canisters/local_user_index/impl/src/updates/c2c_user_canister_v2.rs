use crate::guards::caller_is_local_multi_user_canister;
use crate::{RuntimeState, UserIndexEvent, mutate_state};
use canister_api_macros::update;
use canister_time::now_millis;
use canister_tracing_macros::trace;
use local_user_index_canister::UserEvent;
use local_user_index_canister::c2c_user_canister_v2::*;
use stable_memory_map::StableMemoryMap;
use std::cell::LazyCell;
use types::{BotEvent, BotLifecycleEvent, Notification, StreakInsuranceClaim, StreakInsurancePayment, TimestampMillis, UserId};
use user_index_canister::BotInstalled;

// Takes events from MultiUser canisters. Each event names the user it is from, which must be one of
// the users the calling canister hosts, other than an event about the canister itself, which names
// the canister.
#[update(guard = "caller_is_local_multi_user_canister", msgpack = true)]
#[trace]
fn c2c_user_canister_v2(args: ArgsInternal) -> Response {
    mutate_state(|state| c2c_user_canister_v2_impl(args, state))
}

fn c2c_user_canister_v2_impl(args: ArgsInternal, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    let now = LazyCell::new(now_millis);
    for event in args.events {
        let user_id = event.value.user_id;
        if !is_valid_event_for_caller(user_id, &event.value.event, caller) {
            continue;
        }
        if state
            .data
            .idempotency_checker
            .check(caller, event.created_at, event.idempotency_id)
        {
            handle_event(user_id, event.value.event, &now, state);
        }
    }
    Response::Success
}

// An event about the calling MultiUser canister itself must name the canister, and any other must
// name one of the users it hosts
fn is_valid_event_for_caller<T>(user_id: UserId, event: &UserEvent<T>, caller: candid::Principal) -> bool {
    if event.is_about_canister() {
        user_id == UserId::from(caller)
    } else {
        is_valid_user_for_caller(user_id, caller)
    }
}

// A user hosted by the calling MultiUser canister carries a non-zero index, which rules out the
// canister's own id (index 0)
pub(crate) fn is_valid_user_for_caller(user_id: UserId, caller: candid::Principal) -> bool {
    user_id.index() != 0 && user_id.canister_id() == caller
}

fn handle_event<F: FnOnce() -> TimestampMillis>(
    user_id: UserId,
    event: UserEvent,
    now: &LazyCell<TimestampMillis, F>,
    state: &mut RuntimeState,
) {
    match event {
        UserEvent::NotifyChit(ev) => {
            // TODO set CHIT record here
            // state.data.global_users.insert_chit_record(user_id, ..);
            state.push_event_to_user_index(UserIndexEvent::NotifyChit(Box::new((user_id, ev))), **now);
        }
        UserEvent::NotifyStreakInsurancePayment(payment) => {
            state.push_event_to_user_index(
                UserIndexEvent::NotifyStreakInsurancePayment(Box::new(StreakInsurancePayment {
                    user_id,
                    timestamp: payment.timestamp,
                    chat_amount: payment.chat_amount,
                    additional_days: payment.additional_days,
                    new_days_insured: payment.new_days_insured,
                    transaction_index: payment.transaction_index,
                })),
                **now,
            );
        }
        UserEvent::NotifyStreakInsuranceClaim(claim) => {
            state.push_event_to_user_index(
                UserIndexEvent::NotifyStreakInsuranceClaim(Box::new(StreakInsuranceClaim {
                    user_id,
                    timestamp: claim.timestamp,
                    streak_length: claim.streak_length,
                    new_days_claimed: claim.new_days_claimed,
                })),
                **now,
            );
        }
        // A migrated user may still be named by their old id, eg. by the canisters of those who had
        // blocked them before, whereas the pairs are held under their latest id
        UserEvent::UserBlocked(blocked) => {
            let blocked = state.data.migrated_user_ids.latest(blocked);
            state.data.blocked_users.insert((blocked, user_id), ());
            state.push_event_to_user_index(UserIndexEvent::UserBlocked(user_id, blocked), **now);
        }
        UserEvent::UserUnblocked(unblocked) => {
            let unblocked = state.data.migrated_user_ids.latest(unblocked);
            state.data.blocked_users.remove(&(unblocked, user_id));
            state.push_event_to_user_index(UserIndexEvent::UserUnblocked(user_id, unblocked), **now);
        }
        UserEvent::UserSetProfileBackground(profile_background_id) => {
            state.push_event_to_user_index(
                UserIndexEvent::UserSetProfileBackground(Box::new((user_id, profile_background_id))),
                **now,
            );
        }
        UserEvent::UserSetAvatar(avatar_id) => {
            state.push_event_to_user_index(UserIndexEvent::UserSetAvatar(Box::new((user_id, avatar_id))), **now);
        }
        UserEvent::SetMaxStreak(max_streak) => {
            state.push_event_to_user_index(UserIndexEvent::SetMaxStreak(user_id, max_streak), **now);
        }
        UserEvent::EventStoreEvent(event) => state.data.event_store_client.push(event),
        // No longer sent, but still read until every MultiUser canister is on a version which doesn't
        // send it
        UserEvent::UserIdMigrationComplete(_) => {}
        UserEvent::Notification(mut notification) => {
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

            state.handle_notification(*notification, state.env.canister_id(), **now);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;

    #[test]
    fn events_about_the_canister_must_name_it_and_others_one_of_its_users() {
        let canister = Principal::from_text("yaxqu-oqaaa-aaaaf-br7ya-cai").unwrap();
        let other_canister = Principal::from_text("ryjl3-tyaaa-aaaaa-aaaba-cai").unwrap();
        let its_user = UserId::new_indexed(canister, 1);
        let about_canister = UserEvent::<()>::UserIdMigrationComplete(true);
        let about_user = UserEvent::<()>::SetMaxStreak(1);

        assert!(is_valid_event_for_caller(canister.into(), &about_canister, canister));
        assert!(!is_valid_event_for_caller(its_user, &about_canister, canister));
        assert!(!is_valid_event_for_caller(other_canister.into(), &about_canister, canister));

        assert!(is_valid_event_for_caller(its_user, &about_user, canister));
        assert!(!is_valid_event_for_caller(canister.into(), &about_user, canister));
        assert!(!is_valid_event_for_caller(
            UserId::new_indexed(other_canister, 1),
            &about_user,
            canister
        ));
    }
}
