use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_proposals_bot;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::c2c_update_proposals::*;
use oc_error_codes::OCErrorCode;
use types::OCResult;

#[update(msgpack = true, guard = "caller_is_proposals_bot")]
#[trace]
fn c2c_update_proposals(args: Args) -> Response {
    execute_update(|state| c2c_update_proposals_impl(args, state)).into()
}

fn c2c_update_proposals_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let member = state.get_calling_member(false)?;
    let channel = state.data.channels.get_mut_or_err(&args.channel_id)?;

    if channel.chat.members.get(&member.user_id).is_none() {
        return Err(OCErrorCode::InitiatorNotInChat.into());
    }

    if channel
        .chat
        .events
        .update_proposals(member.user_id, args.proposals, state.env.now())
    {
        handle_activity_notification(state);
    }
    Ok(())
}
