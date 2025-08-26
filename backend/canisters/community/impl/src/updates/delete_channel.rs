use crate::guards::caller_is_local_user_index;
use crate::{
    RuntimeState, activity_notifications::handle_activity_notification, execute_update, model::events::CommunityEventInternal,
};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::c2c_bot_delete_channel;
use community_canister::delete_channel::*;
use group_community_common::Member;
use oc_error_codes::OCErrorCode;
use stable_memory_map::{BaseKeyPrefix, ChatEventKeyPrefix, UserIdKeyPrefix};
use types::{BotCaller, Caller, ChannelDeleted, ChannelId, OCResult};

#[update(msgpack = true)]
#[trace]
fn delete_channel(args: Args) -> Response {
    execute_update(|state| delete_channel_impl(args.channel_id, None, state)).into()
}

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_bot_delete_channel(args: c2c_bot_delete_channel::Args) -> c2c_bot_delete_channel::Response {
    execute_update(|state| c2c_bot_delete_channel_impl(args, state).into())
}

fn c2c_bot_delete_channel_impl(args: c2c_bot_delete_channel::Args, state: &mut RuntimeState) -> OCResult {
    let bot_caller = BotCaller {
        bot: args.bot_id,
        initiator: args.initiator.clone(),
    };

    delete_channel_impl(args.channel_id, Some(Caller::BotV2(bot_caller)), state)
}

fn delete_channel_impl(channel_id: ChannelId, ext_caller: Option<Caller>, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let caller = state.verified_caller(ext_caller)?;
    let channel = state.data.channels.get_or_err(&channel_id)?;

    // A community owner can delete a channel whether or not they are a member of the channel
    let caller_is_community_owner = state
        .data
        .members
        .get_by_user_id(&caller.agent())
        .is_some_and(|m| m.is_owner());

    if !caller_is_community_owner {
        let channel_member = channel.chat.members.get_verified_member(caller.agent())?;
        if !channel_member.role().can_delete_group() {
            return Err(OCErrorCode::InitiatorNotAuthorized.into());
        }
    }

    // If the agent is a bot and the initiator is a user (by command), then also check the user has permission
    if let Caller::BotV2(bot_caller) = &caller
        && let Some(initiator) = bot_caller.initiator.user()
        && !channel
            .chat
            .members
            .get(&initiator)
            .is_some_and(|member| member.role().can_delete_group())
    {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
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

    state.push_community_event(CommunityEventInternal::ChannelDeleted(Box::new(ChannelDeleted {
        channel_id,
        name: channel.chat.name.value,
        deleted_by: caller.agent(),
        bot_command: caller.bot_command().cloned(),
    })));

    for user_id in channel.chat.members.member_ids() {
        state.data.members.mark_member_left_channel(*user_id, channel_id, true, now);
    }

    if channel.chat.gate_config.value.is_some_and(|gc| gc.expiry.is_some()) {
        state.data.expiring_members.remove_gate(Some(channel_id));
    }

    if channel.chat.is_public.value {
        state.data.public_channel_list_updated = now;
    }

    handle_activity_notification(state);

    Ok(())
}
