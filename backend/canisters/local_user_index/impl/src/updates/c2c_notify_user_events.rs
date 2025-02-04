use crate::guards::caller_is_local_user_canister;
use crate::{mutate_state, RuntimeState, UserIndexEvent};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::c2c_notify_user_events::{Response::*, *};
use local_user_index_canister::UserEvent;
use types::{StreakInsuranceClaim, StreakInsurancePayment, UserId};

#[update(guard = "caller_is_local_user_canister", msgpack = true)]
#[trace]
fn c2c_notify_user_events(args: Args) -> Response {
    mutate_state(|state| c2c_notify_user_events_impl(args, state))
}

fn c2c_notify_user_events_impl(args: Args, state: &mut RuntimeState) -> Response {
    let user_id = state.env.caller().into();
    for event in args.events {
        handle_event(user_id, event, state);
    }
    Success
}

fn handle_event(user_id: UserId, event: UserEvent, state: &mut RuntimeState) {
    match event {
        UserEvent::NotifyChit(ev) => {
            state.push_event_to_user_index(UserIndexEvent::NotifyChit(Box::new((user_id, ev))));
        }
        UserEvent::NotifyStreakInsurancePayment(payment) => {
            state.push_event_to_user_index(UserIndexEvent::NotifyStreakInsurancePayment(Box::new(
                StreakInsurancePayment {
                    user_id,
                    timestamp: payment.timestamp,
                    chat_amount: payment.chat_amount,
                    additional_days: payment.additional_days,
                    new_days_insured: payment.new_days_insured,
                    transaction_index: payment.transaction_index,
                },
            )));
        }
        UserEvent::NotifyStreakInsuranceClaim(claim) => {
            state.push_event_to_user_index(UserIndexEvent::NotifyStreakInsuranceClaim(Box::new(StreakInsuranceClaim {
                user_id,
                timestamp: claim.timestamp,
                streak_length: claim.streak_length,
                new_days_claimed: claim.new_days_claimed,
            })));
        }
        UserEvent::UserBlocked(blocked) => {
            state.push_event_to_user_index(UserIndexEvent::UserBlocked(user_id, blocked));
        }
        UserEvent::UserUnblocked(unblocked) => {
            state.push_event_to_user_index(UserIndexEvent::UserUnblocked(user_id, unblocked));
        }
    }
}
