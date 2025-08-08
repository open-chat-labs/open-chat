use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_local_user_index;
use crate::{CommunityEventPusher, RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::{add_reaction::*, c2c_bot_add_reaction};
use oc_error_codes::OCErrorCode;
use types::{
    Achievement, BotCaller, BotPermissions, Caller, ChannelReactionAddedNotification, Chat, ChatPermission, CommunityId,
    EventIndex, OCResult, UserNotificationPayload,
};
use user_canister::{CommunityCanisterEvent, MessageActivity, MessageActivityEvent};

#[update(msgpack = true)]
#[trace]
fn add_reaction(args: Args) -> Response {
    execute_update(|state| add_reaction_impl(args, None, state)).into()
}

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_bot_add_reaction(args: c2c_bot_add_reaction::Args) -> c2c_bot_add_reaction::Response {
    execute_update(|state| c2c_bot_add_reaction_impl(args, state).into())
}

fn c2c_bot_add_reaction_impl(args: c2c_bot_add_reaction::Args, state: &mut RuntimeState) -> OCResult {
    let bot_caller = BotCaller {
        bot: args.bot_id,
        initiator: args.initiator.clone(),
    };

    let args = Args {
        channel_id: args.channel_id,
        thread_root_message_index: args.thread,
        message_id: args.message_id,
        reaction: args.reaction,
        username: args.bot_name,
        display_name: None,
        new_achievement: false,
    };

    if !state.data.is_bot_permitted(
        &bot_caller.bot,
        Some(args.channel_id),
        &bot_caller.initiator,
        &BotPermissions::from_chat_permission(ChatPermission::ReactToMessages),
    ) {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    add_reaction_impl(args, Some(Caller::BotV2(bot_caller)), state)
}

fn add_reaction_impl(args: Args, ext_caller: Option<Caller>, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let caller = state.verified_caller(ext_caller)?;
    let new_achievement = args.new_achievement;
    let channel = state.data.channels.get_mut_or_err(&args.channel_id)?;
    let now = state.env.now();
    let agent = caller.agent();

    let result = channel.chat.add_reaction(
        caller,
        args.thread_root_message_index,
        args.message_id,
        args.reaction.clone(),
        now,
        CommunityEventPusher {
            now,
            rng: state.env.rng(),
            queue: &mut state.data.local_user_index_event_sync_queue,
        },
    )?;

    if let Some((message, event_index)) =
        channel
            .chat
            .events
            .message_internal(EventIndex::default(), args.thread_root_message_index, args.message_id.into())
    {
        if let Some(sender) = channel.chat.members.get(&message.sender)
            && message.sender != agent && !sender.user_type().is_bot() {
                let community_id: CommunityId = state.env.canister_id().into();

                let notifications_muted = channel
                    .chat
                    .members
                    .get(&message.sender)
                    .is_none_or(|m| m.notifications_muted().value || m.suspended().value);

                if !notifications_muted {
                    let display_name = state
                        .data
                        .members
                        .get_by_user_id(&agent)
                        .and_then(|m| m.display_name().value.clone())
                        .or(args.display_name);
                    let channel_avatar_id = channel.chat.avatar.as_ref().map(|d| d.id);

                    let notification = UserNotificationPayload::ChannelReactionAdded(ChannelReactionAddedNotification {
                        community_id,
                        channel_id: args.channel_id,
                        thread_root_message_index: args.thread_root_message_index,
                        message_index: message.message_index,
                        message_event_index: event_index,
                        community_name: state.data.name.value.clone(),
                        channel_name: channel.chat.name.value.clone(),
                        added_by: agent,
                        added_by_name: args.username,
                        added_by_display_name: display_name,
                        reaction: args.reaction,
                        community_avatar_id: state.data.avatar.as_ref().map(|d| d.id),
                        channel_avatar_id,
                    });

                    state.push_notification(Some(agent), vec![message.sender], notification);
                }

                state.push_event_to_user(
                    message.sender,
                    CommunityCanisterEvent::MessageActivity(MessageActivityEvent {
                        chat: Chat::Channel(community_id, args.channel_id),
                        thread_root_message_index: args.thread_root_message_index,
                        message_index: message.message_index,
                        message_id: message.message_id,
                        event_index,
                        activity: MessageActivity::Reaction,
                        timestamp: now,
                        user_id: Some(agent),
                    }),
                    now,
                );

                state.notify_user_of_achievement(message.sender, Achievement::HadMessageReactedTo, now);
            }

        if new_achievement {
            state.notify_user_of_achievement(agent, Achievement::ReactedToMessage, now);
        }
    }

    state.push_bot_notification(result.bot_notification);
    handle_activity_notification(state);
    Ok(())
}
