use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use community_canister::decline_invitation::{Response::*, *};
use ic_cdk_macros::update;

#[update]
#[trace]
fn decline_invitation(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| decline_invitation_impl(args, state))
}

fn decline_invitation_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    let now = state.env.now();

    let result = if let Some(user_id) = state.data.members.lookup_user_id(caller) {
        if let Some(channel_id) = args.channel_id {
            if let Some(channel) = state.data.channels.get_mut(&channel_id) {
                match channel.chat.invited_users.remove(&user_id, now) {
                    Some(_) => Success,
                    None => NotInvited,
                }
            } else {
                ChannelNotFound
            }
        } else {
            match state.data.invited_users.remove(&user_id, now) {
                Some(_) => Success,
                None => NotInvited,
            }
        }
    } else {
        UserNotInCommunity
    };

    // If the user isn't a member of the community, remove their principal and user_id from
    // `members`
    if matches!(result, Success) && state.data.members.get(caller).is_none() {
        state.data.members.remove_by_principal(&caller);
    }

    result
}
