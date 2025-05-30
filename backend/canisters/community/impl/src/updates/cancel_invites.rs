use crate::{RuntimeState, activity_notifications::handle_activity_notification, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::cancel_invites::*;
use oc_error_codes::OCErrorCode;
use types::OCResult;

#[update(msgpack = true)]
#[trace]
fn cancel_invites(args: Args) -> Response {
    execute_update(|state| cancel_invites_impl(args, state)).into()
}

fn cancel_invites_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let member = state.get_calling_member(true)?;
    let now = state.env.now();

    if let Some(channel_id) = args.channel_id {
        let channel = state.data.channels.get_mut_or_err(&channel_id)?;
        channel.chat.cancel_invites(member.user_id, args.user_ids, now)?;
    } else {
        if !member.role().can_invite_users(&state.data.permissions) {
            return Err(OCErrorCode::InitiatorNotAuthorized.into());
        }

        for user_id in args.user_ids {
            if state.data.invited_users.remove(&user_id, now).is_some() {
                for channel in state.data.channels.iter_mut() {
                    channel.chat.cancel_invite_unchecked(&user_id, now);
                }
            }
        }
    }

    handle_activity_notification(state);
    Ok(())
}
