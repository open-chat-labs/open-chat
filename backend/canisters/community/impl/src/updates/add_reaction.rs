use crate::model::members::CommunityMembers;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_candid_and_msgpack;
use canister_tracing_macros::trace;
use chat_events::Reader;
use community_canister::add_reaction::{Response::*, *};
use group_chat_core::{AddRemoveReactionResult, GroupChatCore};
use types::{CommunityReactionAddedNotification, EventIndex, EventWrapper, Message, Notification, TimestampMillis, UserId};

#[update_candid_and_msgpack]
#[trace]
fn add_reaction(args: Args) -> Response {
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
        }

        let user_id = member.user_id;
        let now = state.env.now();

        if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
            match channel.chat.add_reaction(
                user_id,
                args.thread_root_message_index,
                args.message_id,
                args.reaction.clone(),
                now,
            ) {
                AddRemoveReactionResult::Success => {
                    if let Some(message) = should_push_notification(&args, user_id, &channel.chat, &state.data.members, now) {
                        push_notification(args, user_id, channel.chat.name.clone(), message, now, state);
                    }
                    Success
                }
                AddRemoveReactionResult::NoChange => NoChange,
                AddRemoveReactionResult::InvalidReaction => InvalidReaction,
                AddRemoveReactionResult::MessageNotFound => MessageNotFound,
                AddRemoveReactionResult::UserNotInGroup => UserNotInChannel,
                AddRemoveReactionResult::NotAuthorized => NotAuthorized,
                AddRemoveReactionResult::UserSuspended => UserSuspended,
            }
        } else {
            ChannelNotFound
        }
    } else {
        UserNotInCommunity
    }
}

fn should_push_notification(
    args: &Args,
    user_id: UserId,
    chat: &GroupChatCore,
    members: &CommunityMembers,
    now: TimestampMillis,
) -> Option<EventWrapper<Message>> {
    let message = chat
        .events
        .events_reader(EventIndex::default(), args.thread_root_message_index, now)
        // We pass in `None` in place of `my_user_id` because we don't want to hydrate
        // the notification with data for the current user (eg. their poll votes).
        .and_then(|events_reader| events_reader.message_event(args.message_id.into(), None))?;

    let sender = message.event.sender;

    if sender != user_id {
        let notifications_muted_in_channel = chat
            .members
            .get(&sender)
            .map_or(true, |m| m.notifications_muted.value || m.suspended.value);

        let notifications_muted_in_community = members
            .get_by_user_id(&sender)
            .map_or(true, |m| m.notifications_muted.value || m.suspended.value);

        if !(notifications_muted_in_channel || notifications_muted_in_community) {
            return Some(message);
        }
    }

    None
}

fn push_notification(
    args: Args,
    user_id: UserId,
    channel_name: String,
    message: EventWrapper<Message>,
    now: TimestampMillis,
    state: &mut RuntimeState,
) {
    let recipient = message.event.sender;
    let notification = Notification::CommunityReactionAddedNotification(CommunityReactionAddedNotification {
        community_id: state.env.canister_id().into(),
        channel_id: args.channel_id,
        thread_root_message_index: args.thread_root_message_index,
        community_name: state.data.name.clone(),
        channel_name,
        added_by: user_id,
        added_by_name: args.username,
        message,
        reaction: args.reaction,
        timestamp: now,
    });

    state.push_notification(vec![recipient], notification);
}
