use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::unfollow_thread::{Response::*, *};
use oc_error_codes::OCErrorCode;
use types::OCResult;

#[update(msgpack = true)]
#[trace]
fn unfollow_thread(args: Args) -> Response {
    run_regular_jobs();

    if let Err(error) = mutate_state(|state| unfollow_thread_impl(args, state)) {
        Error(error)
    } else {
        Success
    }
}

fn unfollow_thread_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let caller = state.env.caller();
    let user_id = match state.data.lookup_user_id(caller) {
        Some(uid) => uid,
        None => return Err(OCErrorCode::InitiatorNotInChat.into()),
    };

    let now = state.env.now();
    state
        .data
        .chat
        .unfollow_thread(user_id, args.thread_root_message_index, now)?;

    state.data.mark_group_updated_in_user_canister(user_id);
    Ok(())
}
