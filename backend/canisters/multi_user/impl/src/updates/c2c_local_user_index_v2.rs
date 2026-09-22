use crate::guards::caller_is_local_user_index;
use crate::{RuntimeState, mutate_state, openchat_bot};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::LocalUserIndexEvent;
use user_canister::c2c_local_user_index_v2::*;

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
    let Some(effects) = state.data.users.with_user_mut(user_index, |user| {
        user_core::updates::c2c_local_user_index::apply(user, event, now)
    }) else {
        return;
    };

    if effects.chit_changed {
        state.notify_user_index_of_chit(user_index, now);
    }
    for message in effects.bot_messages {
        openchat_bot::send_message(user_index, message.content, message.mentioned, false, state);
    }
    if let Some((_, status)) = effects.referral_status {
        state.set_referral_status_of_referrer(user_index, status, now);
    }
    state.garbage_collect_stable_memory_keys(user_index, effects.garbage_collect);
}
