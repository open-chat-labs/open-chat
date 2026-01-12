use crate::guards::caller_is_local_user_canister;
use crate::{RuntimeState, UserIndexEvent, mutate_state};
use canister_api_macros::update;
use canister_time::now_millis;
use canister_tracing_macros::trace;
use local_user_index_canister::UserEvent;
use local_user_index_canister::c2c_user_canister::*;
use stable_memory_map::StableMemoryMap;
use std::cell::LazyCell;
use types::{BotEvent, BotLifecycleEvent, Notification, StreakInsuranceClaim, StreakInsurancePayment, TimestampMillis, UserId};
use user_index_canister::BotInstalled;

#[update(guard = "caller_is_local_user_canister", msgpack = true)]
#[trace]
fn c2c_user_canister(args: ArgsInternal) -> Response {
    mutate_state(|state| c2c_user_canister_impl(args, state))
}

fn c2c_user_canister_impl(args: ArgsInternal, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    let user_id = caller.into();
    let now = LazyCell::new(now_millis);
    for event in args.events {
        if state
            .data
            .idempotency_checker
            .check(caller, event.created_at, event.idempotency_id)
        {
            handle_event(user_id, event.value, &now, state);
        }
    }
    Response::Success
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
        UserEvent::UserBlocked(blocked) => {
            state.data.blocked_users.insert((blocked, user_id), ());
            state.push_event_to_user_index(UserIndexEvent::UserBlocked(user_id, blocked), **now);
        }
        UserEvent::UserUnblocked(unblocked) => {
            state.data.blocked_users.remove(&(unblocked, user_id));
            state.push_event_to_user_index(UserIndexEvent::UserUnblocked(user_id, unblocked), **now);
        }
        UserEvent::UserSetProfileBackground(profile_background_id) => {
            state.push_event_to_user_index(
                UserIndexEvent::UserSetProfileBackground(Box::new((user_id, profile_background_id))),
                **now,
            );
        }
        UserEvent::SetMaxStreak(max_streak) => {
            state.push_event_to_user_index(UserIndexEvent::SetMaxStreak(user_id, max_streak), **now);
        }
        UserEvent::EventStoreEvent(event) => state.data.event_store_client.push(event),
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
