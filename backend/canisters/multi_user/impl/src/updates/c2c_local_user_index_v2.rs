use crate::guards::caller_is_local_user_index;
use crate::{RuntimeState, execute_update, openchat_bot};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::c2c_local_user_index_v2::*;
use user_canister::{LocalUserIndexEvent, SetReferralStatusV2, UserCanisterEvent};

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_local_user_index_v2(args: Args) -> Response {
    execute_update(|state| c2c_local_user_index_v2_impl(args, state))
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
    // Events for the user's old id are then sent straight to their new one
    if let LocalUserIndexEvent::UserIdMigrated(ev) = &event {
        state.data.migrated_user_ids.insert(ev.old_user_id, ev.new_user_id);
    }
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
    if let Some((referred_by, status)) = effects.referral_status {
        // A user migrated here sends the ids they had before, which their referrer may hold their
        // referral under. Any other user sends the original event, which every User canister takes.
        let previous_user_ids = state.data.migrated_user_ids.previous_ids(state.user_id(user_index));
        let event = if previous_user_ids.is_empty() {
            UserCanisterEvent::SetReferralStatus(Box::new(status))
        } else {
            UserCanisterEvent::SetReferralStatusV2(Box::new(SetReferralStatusV2 {
                status,
                previous_user_ids,
            }))
        };
        state.send_user_canister_event(user_index, referred_by, event);
    }
    state.garbage_collect_stable_memory_keys(user_index, effects.garbage_collect);
}
