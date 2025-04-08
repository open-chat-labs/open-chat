use crate::{activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::remove_reaction::{Response::*, *};
use oc_error_codes::{OCError, OCErrorCode};

#[update(msgpack = true)]
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
    state.data.verify_not_frozen()?;

    let caller = state.env.caller();

    let user_id = state.data.members.get_verified_member(caller)?.user_id;
    let now = state.env.now();

    let Some(channel) = state.data.channels.get_mut(&args.channel_id) else {
        return Err(OCErrorCode::ChatNotFound.into());
    };

    channel
        .chat
        .remove_reaction(user_id, args.thread_root_message_index, args.message_id, args.reaction, now)?;

    handle_activity_notification(state);
    Ok(())
}
