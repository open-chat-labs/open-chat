use crate::{
    activity_notifications::handle_activity_notification, model::events::CommunityEventInternal, mutate_state,
    run_regular_jobs, RuntimeState,
};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::delete_channel::{Response::*, *};
use stable_memory_map::{BaseKeyPrefix, ChatEventKeyPrefix, MemberKeyPrefix};
use tracing::info;
use types::{ChannelDeleted, ChannelId};

#[update(msgpack = true)]
#[trace]
fn delete_channel(args: Args) -> Response {
    run_regular_jobs();

    let response = mutate_state(|state| delete_channel_impl(args.channel_id, state));

    if !matches!(response, Success) {
        info!(channel_id = ?args.channel_id, ?response, "Delete channel failed");
    }

    response
}

fn delete_channel_impl(channel_id: ChannelId, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();

    if state.data.is_frozen() {
        return CommunityFrozen;
    }

    let Some(member) = state.data.members.get(caller) else {
        return UserNotInCommunity;
    };

    if member.suspended().value {
        return UserSuspended;
    } else if member.lapsed().value {
        return UserLapsed;
    }

    let Some(channel) = state.data.channels.get(&channel_id) else {
        return ChannelNotFound;
    };

    let user_id = member.user_id;
    let Some(channel_member) = channel.chat.members.get(&user_id) else {
        return UserNotInChannel;
    };

    if channel_member.lapsed().value {
        return UserLapsed;
    } else if !channel_member.role().can_delete_group() {
        return NotAuthorized;
    }

    let now = state.env.now();
    let channel = state.data.channels.delete(channel_id).expect("Channel should exist");

    state
        .data
        .stable_memory_keys_to_garbage_collect
        .push(BaseKeyPrefix::from(ChatEventKeyPrefix::new_from_channel(channel_id, None)));

    for message_index in channel.chat.events.thread_keys() {
        state
            .data
            .stable_memory_keys_to_garbage_collect
            .push(BaseKeyPrefix::from(ChatEventKeyPrefix::new_from_channel(
                channel_id,
                Some(message_index),
            )));
    }

    state
        .data
        .stable_memory_keys_to_garbage_collect
        .push(BaseKeyPrefix::from(MemberKeyPrefix::new_from_channel(channel_id)));

    crate::jobs::garbage_collect_stable_memory::start_job_if_required(state);

    state.data.events.push_event(
        CommunityEventInternal::ChannelDeleted(Box::new(ChannelDeleted {
            channel_id,
            name: channel.chat.name.value,
            deleted_by: user_id,
        })),
        now,
    );

    for user_id in channel.chat.members.member_ids() {
        state.data.members.mark_member_left_channel(*user_id, channel_id, true, now);
    }

    if channel.chat.gate_config.value.is_some_and(|gc| gc.expiry.is_some()) {
        state.data.expiring_members.remove_gate(Some(channel_id));
    }

    handle_activity_notification(state);

    Success
}
