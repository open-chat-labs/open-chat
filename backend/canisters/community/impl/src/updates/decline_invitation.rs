use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::decline_invitation::*;
use oc_error_codes::OCErrorCode;
use types::OCResult;

#[update(msgpack = true)]
#[trace]
fn decline_invitation(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| decline_invitation_impl(args, state)).into()
}

fn decline_invitation_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let user_id = state.get_caller_user_id()?;
    let now = state.env.now();
    if let Some(channel_id) = args.channel_id {
        let channel = state.data.channels.get_mut_or_err(&channel_id)?;
        match channel.chat.invited_users.remove(&user_id, now) {
            Some(_) => Ok(()),
            None => Err(OCErrorCode::NoChange.into()),
        }
    } else {
        match state.data.invited_users.remove(&user_id, now) {
            Some(_) => {
                for channel in state.data.channels.iter_mut() {
                    channel.chat.invited_users.remove(&user_id, now);
                }

                // If the user isn't a member of the community, remove their principal and user_id from
                // `members`
                let caller = state.env.caller();
                if state.data.members.get(caller).is_none() {
                    state.data.members.remove_by_principal(caller, now);
                }
                Ok(())
            }
            None => Err(OCErrorCode::NoChange.into()),
        }
    }
}
