use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use community_canister::leave_channel::{Response::*, *};
use ic_cdk_macros::update;
use types::MemberLeft;

#[update]
#[trace]
fn leave_channel(args: Args) -> Response {
    mutate_state(|state| leave_channel_impl(args, state))
}

fn leave_channel_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    if let Some(member) = state.data.members.get(caller) {
        if member.suspended.value {
            return UserSuspended;
        }

        if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
            if let Some(channel_member) = channel.chat.members.remove(member.user_id) {
                if channel_member.role.is_owner() && channel.chat.members.owner_count() == 1 {
                    return LastOwnerCannotLeave;
                }

                channel.chat.events.push_main_event(
                    ChatEventInternal::ParticipantLeft(Box::new(MemberLeft { user_id: member.user_id })),
                    0,
                    state.env.now(),
                );

                Success
            } else {
                UserNotInChannel
            }
        } else {
            ChannelNotFound
        }
    } else {
        UserNotInCommunity
    }
}
