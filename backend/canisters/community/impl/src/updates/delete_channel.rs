use crate::{model::events::CommunityEvent, mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use community_canister::delete_channel::{Response::*, *};
use ic_cdk_macros::update;
use types::{ChannelDeleted, ChannelId};

#[update]
#[trace]
fn delete_channel(args: Args) -> Response {
    mutate_state(|state| delete_channel_impl(args.channel_id, state))
}

fn delete_channel_impl(channel_id: ChannelId, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();

    if state.data.is_frozen() {
        return CommunityFrozen;
    }

    if let Some(member) = state.data.members.get(caller) {
        if member.suspended.value {
            return UserSuspended;
        }

        if let Some(channel) = state.data.channels.get(&channel_id) {
            let user_id = member.user_id;
            if let Some(channel_member) = channel.chat.members.get(&user_id) {
                if channel_member.role.can_delete_group() {
                    let now = state.env.now();
                    let channel = state.data.channels.delete(channel_id).expect("Channel should exist");

                    state.data.events.push_event(
                        CommunityEvent::ChannelDeleted(Box::new(ChannelDeleted {
                            channel_id,
                            name: channel.chat.name,
                            deleted_by: user_id,
                        })),
                        now,
                    );
                    Success
                } else {
                    NotAuthorized
                }
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
