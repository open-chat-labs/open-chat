use crate::guards::caller_is_local_user_index;
use crate::CallerResult;
use crate::{
    activity_notifications::handle_activity_notification, model::events::CommunityEventInternal, mutate_state,
    run_regular_jobs, RuntimeState,
};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::c2c_bot_delete_channel;
use community_canister::delete_channel::{Response::*, *};
use group_community_common::Member;
use stable_memory_map::{BaseKeyPrefix, ChatEventKeyPrefix, UserIdKeyPrefix};
use types::{BotCaller, Caller, ChannelDeleted, ChannelId};

#[update(msgpack = true)]
#[trace]
fn delete_channel(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| delete_channel_impl(args.channel_id, None, state))
}

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_bot_delete_channel(args: c2c_bot_delete_channel::Args) -> c2c_bot_delete_channel::Response {
    run_regular_jobs();

    let bot_caller = BotCaller {
        bot: args.bot_id,
        initiator: args.initiator.clone(),
    };

    mutate_state(|state| delete_channel_impl(args.channel_id, Some(bot_caller), state)).into()
}

fn delete_channel_impl(channel_id: ChannelId, bot_caller: Option<BotCaller>, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return CommunityFrozen;
    }

    let caller = match state.verified_caller(bot_caller) {
        CallerResult::Success(caller) => caller,
        CallerResult::NotFound => return NotAuthorized,
        CallerResult::Suspended => return UserSuspended,
        CallerResult::Lapsed => return UserLapsed,
    };

    let Some(channel) = state.data.channels.get(&channel_id) else {
        return ChannelNotFound;
    };

    let Some(channel_member) = channel.chat.members.get(&caller.agent()) else {
        return UserNotInChannel;
    };

    if channel_member.lapsed().value {
        return UserLapsed;
    }

    if !channel_member.role().can_delete_group()
        && !state
            .data
            .members
            .get_by_user_id(&caller.agent())
            .is_some_and(|m| m.is_owner())
    {
        return NotAuthorized;
    }

    // If the agent is a bot and the initiator is a user (by command), then also check the user has permission
    if let Caller::BotV2(bot_caller) = &caller {
        if let Some(initiator) = bot_caller.initiator.user() {
            if !channel
                .chat
                .members
                .get(&initiator)
                .is_some_and(|member| member.role().can_delete_group())
            {
                return NotAuthorized;
            }
        }
    }

    let now = state.env.now();
    let channel = state.data.channels.delete(channel_id, now).expect("Channel should exist");

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
        .push(BaseKeyPrefix::from(UserIdKeyPrefix::new_from_channel(channel_id)));

    crate::jobs::garbage_collect_stable_memory::start_job_if_required(state);

    state.data.events.push_event(
        CommunityEventInternal::ChannelDeleted(Box::new(ChannelDeleted {
            channel_id,
            name: channel.chat.name.value,
            deleted_by: caller.agent(),
            bot_command: caller.bot_command().cloned(),
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
