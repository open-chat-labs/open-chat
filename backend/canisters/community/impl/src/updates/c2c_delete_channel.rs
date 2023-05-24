use crate::{model::events::CommunityEvent, mutate_state, Data, RuntimeState};
use candid::Principal;
use canister_tracing_macros::trace;
use community_canister::c2c_delete_channel::{Response::*, *};
use ic_cdk_macros::update;
use types::{ChannelDeleted, ChannelId, TimestampMillis, UserId};

#[update]
#[trace]
fn c2c_delete_channel(args: Args) -> Response {
    mutate_state(|state| c2c_delete_channel_impl(args.channel_id, state))
}

fn c2c_delete_channel_impl(channel_id: ChannelId, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    let now = state.env.now();

    let response = can_delete_channel(channel_id, caller, &state.data);

    if matches!(response, Success) {
        delete_channel(channel_id, caller.into(), now, &mut state.data);
    }

    Success
}

fn can_delete_channel(channel_id: ChannelId, caller: Principal, data: &Data) -> Response {
    if data.is_frozen() {
        return CommunityFrozen;
    }

    if let Some(member) = data.members.get(caller) {
        if member.suspended.value {
            return UserSuspended;
        }

        if let Some(channel) = data.channels.get(&channel_id) {
            let sender = member.user_id;
            if let Some(channel_member) = channel.members.get(&sender) {
                if channel_member.role.can_delete_group() {
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
        CallerNotInCommunity
    }
}

fn delete_channel(channel_id: ChannelId, deleted_by: UserId, now: TimestampMillis, data: &mut Data) {
    let channel = data.channels.delete(channel_id).expect("Channel should exist");

    data.events.push_event(
        CommunityEvent::ChannelDeleted(Box::new(ChannelDeleted {
            channel_id,
            name: channel.name,
            deleted_by,
        })),
        now,
    );
}
