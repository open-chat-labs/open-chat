use crate::{
    activity_notifications::handle_activity_notification, model::events::CommunityEventInternal, mutate_state,
    run_regular_jobs, RuntimeState,
};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::{ChannelKeyPrefix, ChannelThreadKeyPrefix, KeyPrefix};
use community_canister::delete_channel::{Response::*, *};
use types::{ChannelDeleted, ChannelId};

#[update(candid = true, msgpack = true)]
#[trace]
fn delete_channel(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| delete_channel_impl(args.channel_id, state))
}

fn delete_channel_impl(channel_id: ChannelId, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();

    if state.data.is_frozen() {
        return CommunityFrozen;
    }

    let Some(member) = state.data.members.get(caller) else {
        return UserNotInCommunity;
    };

    if member.suspended.value {
        return UserSuspended;
    } else if member.lapsed.value {
        return UserLapsed;
    }

    let Some(channel) = state.data.channels.get(&channel_id) else {
        return ChannelNotFound;
    };

    let user_id = member.user_id;
    let Some(channel_member) = channel.chat.members.get(&user_id) else {
        return UserNotInChannel;
    };

    if channel_member.lapsed.value {
        return UserLapsed;
    } else if !channel_member.role().can_delete_group() {
        return NotAuthorized;
    }

    let now = state.env.now();
    let channel = state.data.channels.delete(channel_id).expect("Channel should exist");

    state
        .data
        .stable_memory_keys_to_garbage_collect
        .push(KeyPrefix::Channel(ChannelKeyPrefix::new(channel_id)));

    for message_index in channel.chat.events.thread_keys() {
        state
            .data
            .stable_memory_keys_to_garbage_collect
            .push(KeyPrefix::ChannelThread(ChannelThreadKeyPrefix::new(
                channel_id,
                message_index,
            )));
    }
    crate::jobs::garbage_collect_stable_memory::start_job_if_required(state);

    state.data.events.push_event(
        CommunityEventInternal::ChannelDeleted(Box::new(ChannelDeleted {
            channel_id,
            name: channel.chat.name.value,
            deleted_by: user_id,
        })),
        now,
    );

    for user_id in channel.chat.members.iter().map(|m| m.user_id()) {
        state.data.members.mark_member_left_channel(&user_id, channel_id, now);
    }

    handle_activity_notification(state);

    Success
}
