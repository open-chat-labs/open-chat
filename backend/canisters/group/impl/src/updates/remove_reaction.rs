use crate::{activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::remove_reaction::{Response::*, *};
use oc_error_codes::{OCError, OCErrorCode};

#[update(candid = true, msgpack = true)]
#[trace]
fn remove_reaction(args: Args) -> Response {
    run_regular_jobs();

    if let Err(error) = mutate_state(|state| remove_reaction_impl(args, state)) {
        Error(error)
    } else {
        Success
    }
}

fn remove_reaction_impl(args: Args, state: &mut RuntimeState) -> Result<(), OCError> {
    if state.data.is_frozen() {
        return Err(OCErrorCode::ChatFrozen.into());
    }

    let caller = state.env.caller();
    if let Some(user_id) = state.data.lookup_user_id(caller) {
        let now = state.env.now();

        state
            .data
            .chat
            .remove_reaction(user_id, args.thread_root_message_index, args.message_id, args.reaction, now)?;

        handle_activity_notification(state);
        Ok(())
    } else {
        Err(OCErrorCode::InitiatorNotInChat.into())
    }
}
