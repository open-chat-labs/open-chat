use crate::guards::caller_is_local_user_index;
use crate::{RuntimeState, execute_update, openchat_bot};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::IdempotentEnvelope;
use user_canister::c2c_local_user_index::*;
use user_canister::{LocalUserIndexEvent, UserCanisterEvent};

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_local_user_index(args: Args) -> Response {
    execute_update(|state| handle_events(args.events, state))
}

pub(crate) fn handle_events(events: Vec<IdempotentEnvelope<LocalUserIndexEvent>>, state: &mut RuntimeState) -> Response {
    for event in events {
        if state.data.idempotency_checker.check(
            state.data.local_user_index_canister_id,
            event.created_at,
            event.idempotency_id,
        ) {
            process_event(event.value, state);
        }
    }
    Response::Success
}

fn process_event(event: LocalUserIndexEvent, state: &mut RuntimeState) {
    let now = state.env.now();
    let effects = user_core::updates::c2c_local_user_index::apply(&mut state.data.user, event, now);

    if effects.chit_changed {
        state.notify_user_index_of_chit(now);
    }
    for message in effects.bot_messages {
        openchat_bot::send_message(message.content, message.mentioned, false, state);
    }
    if let Some((referred_by, status)) = effects.referral_status {
        state.push_user_canister_event(referred_by, UserCanisterEvent::SetReferralStatus(Box::new(status)));
    }
    state.garbage_collect_stable_memory_keys(effects.garbage_collect);
}
