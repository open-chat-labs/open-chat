use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::add_reaction::{Response::*, *};
use oc_error_codes::{OCError, OCErrorCode};
use types::{Achievement, ChannelReactionAddedNotification, Chat, EventIndex, Notification};
use user_canister::{CommunityCanisterEvent, MessageActivity, MessageActivityEvent};

#[update(msgpack = true)]
#[trace]
fn add_reaction(args: Args) -> Response {
    run_regular_jobs();

    if let Err(error) = mutate_state(|state| add_reaction_impl(args, state)) {
        Error(error)
    } else {
        Success
    }
}

fn add_reaction_impl(args: Args, state: &mut RuntimeState) -> Result<(), OCError> {
    state.data.verify_not_frozen()?;

    let caller = state.env.caller();
    let member = state.data.members.get_verified_member(caller)?;
    let user_id = member.user_id;
    let user_is_bot = member.user_type.is_bot();
    let new_achievement = args.new_achievement;

    if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
        let now = state.env.now();

        channel.chat.add_reaction(
            user_id,
            args.thread_root_message_index,
            args.message_id,
            args.reaction.clone(),
            now,
            &mut state.data.event_store_client,
        )?;

        if let Some((message, event_index)) =
            channel
                .chat
                .events
                .message_internal(EventIndex::default(), args.thread_root_message_index, args.message_id.into())
        {
            if let Some(sender) = channel.chat.members.get(&message.sender) {
                if message.sender != user_id && !sender.user_type().is_bot() {
                    let community_id = state.env.canister_id().into();

                    let notifications_muted = channel
                        .chat
                        .members
                        .get(&message.sender)
                        .is_none_or(|m| m.notifications_muted().value || m.suspended().value);

                    if !notifications_muted {
                        let notification = Notification::ChannelReactionAdded(ChannelReactionAddedNotification {
                            community_id,
                            channel_id: args.channel_id,
                            thread_root_message_index: args.thread_root_message_index,
                            message_index: message.message_index,
                            message_event_index: event_index,
                            community_name: state.data.name.value.clone(),
                            channel_name: channel.chat.name.value.clone(),
                            added_by: user_id,
                            added_by_name: args.username,
                            added_by_display_name: member.display_name().value.clone().or(args.display_name),
                            reaction: args.reaction,
                            community_avatar_id: state.data.avatar.as_ref().map(|d| d.id),
                            channel_avatar_id: channel.chat.avatar.as_ref().map(|d| d.id),
                        });

                        state.push_notification(Some(user_id), vec![message.sender], notification);
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
                            user_id: Some(user_id),
                        }),
                        now,
                    );

                    state.notify_user_of_achievement(message.sender, Achievement::HadMessageReactedTo, now);
                }
            }

            if new_achievement && !user_is_bot {
                state.notify_user_of_achievement(user_id, Achievement::ReactedToMessage, now);
            }
        }

        handle_activity_notification(state);
        Ok(())
    } else {
        Err(OCErrorCode::ChatNotFound.into())
    }
}
