use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::add_reaction::{Response::*, *};
use group_chat_core::AddRemoveReactionResult;
use types::{Achievement, ChannelReactionAddedNotification, Chat, EventIndex, Notification};
use user_canister::{CommunityCanisterEvent, MessageActivity, MessageActivityEvent};

#[update(candid = true, msgpack = true)]
#[trace]
fn add_reaction(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| add_reaction_impl(args, state))
}

fn add_reaction_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return CommunityFrozen;
    }

    let caller = state.env.caller();
    if let Some(member) = state.data.members.get(caller) {
        if member.suspended.value {
            return UserSuspended;
        } else if member.lapsed.value {
            return UserLapsed;
        }
        let user_id = member.user_id;
        let user_is_bot = member.user_type.is_bot();
        let new_achievement = args.new_achievement;

        if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
            let now = state.env.now();
            match channel.chat.add_reaction(
                user_id,
                args.thread_root_message_index,
                args.message_id,
                args.reaction.clone(),
                now,
                &mut state.data.event_store_client,
            ) {
                AddRemoveReactionResult::Success(_) => {
                    if let Some((message, event_index)) = channel.chat.events.message_internal(
                        EventIndex::default(),
                        args.thread_root_message_index,
                        args.message_id.into(),
                    ) {
                        if let Some(sender) = channel.chat.members.get(&message.sender) {
                            if message.sender != user_id && !sender.user_type().is_bot() {
                                let community_id = state.env.canister_id().into();

                                state.data.user_event_sync_queue.push(
                                    message.sender,
                                    CommunityCanisterEvent::MessageActivity(MessageActivityEvent {
                                        chat: Chat::Channel(community_id, channel.id),
                                        thread_root_message_index: args.thread_root_message_index,
                                        message_index: message.message_index,
                                        message_id: message.message_id,
                                        event_index,
                                        activity: MessageActivity::Reaction,
                                        timestamp: now,
                                        user_id: Some(user_id),
                                    }),
                                );

                                let notifications_muted = channel
                                    .chat
                                    .members
                                    .get(&message.sender)
                                    .map_or(true, |m| m.notifications_muted.value || m.suspended.value);

                                if !notifications_muted {
                                    let notification = Notification::ChannelReactionAdded(ChannelReactionAddedNotification {
                                        community_id,
                                        channel_id: args.channel_id,
                                        thread_root_message_index: args.thread_root_message_index,
                                        message_index: message.message_index,
                                        message_event_index: event_index,
                                        community_name: state.data.name.clone(),
                                        channel_name: channel.chat.name.value.clone(),
                                        added_by: user_id,
                                        added_by_name: args.username,
                                        added_by_display_name: member.display_name().value.clone().or(args.display_name),
                                        reaction: args.reaction,
                                        community_avatar_id: state.data.avatar.as_ref().map(|d| d.id),
                                        channel_avatar_id: channel.chat.avatar.as_ref().map(|d| d.id),
                                    });

                                    state.push_notification(vec![message.sender], notification);
                                }

                                state
                                    .data
                                    .notify_user_of_achievement(message.sender, Achievement::HadMessageReactedTo);
                            }
                        }

                        if new_achievement && !user_is_bot {
                            state.data.notify_user_of_achievement(user_id, Achievement::ReactedToMessage);
                        }
                    }

                    handle_activity_notification(state);
                    Success
                }
                AddRemoveReactionResult::NoChange => NoChange,
                AddRemoveReactionResult::InvalidReaction => InvalidReaction,
                AddRemoveReactionResult::MessageNotFound => MessageNotFound,
                AddRemoveReactionResult::UserNotInGroup => UserNotInChannel,
                AddRemoveReactionResult::NotAuthorized => NotAuthorized,
                AddRemoveReactionResult::UserSuspended => UserSuspended,
                AddRemoveReactionResult::UserLapsed => UserLapsed,
            }
        } else {
            ChannelNotFound
        }
    } else {
        UserNotInCommunity
    }
}
