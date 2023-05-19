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
        return ChatFrozen;
    }

    let caller = state.env.caller();
    if let Some(user_id) = state.data.members.get(caller).map(|m| m.user_id) {
        let now = state.env.now();

        if let Some(group) = state.data.groups.get_mut(&args.group_id) {
            match group.add_reaction(
                user_id,
                args.thread_root_message_index,
                args.message_id,
                args.reaction.clone(),
                now,
            ) {
                AddRemoveReactionResult::Success => {
                    if let Some(message) = should_push_notification(&args, user_id, group, &state.data.members, now) {
                        push_notification(args, user_id, group.name.clone(), message, now, state);
                    }
                    Success
                }
                AddRemoveReactionResult::NoChange => NoChange,
                AddRemoveReactionResult::InvalidReaction => InvalidReaction,
                AddRemoveReactionResult::MessageNotFound => MessageNotFound,
                AddRemoveReactionResult::UserNotInGroup => UserNotInGroup,
                AddRemoveReactionResult::NotAuthorized => NotAuthorized,
                AddRemoveReactionResult::UserSuspended => UserSuspended,
            }
        } else {
            UserNotInGroup
        }
    } else {
        CallerNotInCommunity
    }
}

fn should_push_notification(
    args: &Args,
    user_id: UserId,
    group: &GroupChatCore,
    members: &CommunityMembers,
    now: TimestampMillis,
) -> Option<EventWrapper<Message>> {
    let message = group
        .events
        .events_reader(EventIndex::default(), args.thread_root_message_index, now)
        // We pass in `None` in place of `my_user_id` because we don't want to hydrate
        // the notification with data for the current user (eg. their poll votes).
        .and_then(|events_reader| events_reader.message_event(args.message_id.into(), None))?;

    let sender = message.event.sender;
    if sender != user_id {
        let notifications_muted = group.members.get(&sender).map_or(true, |m| m.notifications_muted.value)
            || members
                .get(message.event.sender.into())
                .map_or(true, |p| p.notifications_muted.value);

        if !notifications_muted {
            return Some(message);
        }
    }
    None
}

fn push_notification(
    args: Args,
    user_id: UserId,
    group_name: String,
    message: EventWrapper<Message>,
    now: TimestampMillis,
    state: &mut RuntimeState,
) {
    let recipient = message.event.sender;
    let notification = Notification::CommunityReactionAddedNotification(CommunityReactionAddedNotification {
        community_id: state.env.canister_id().into(),
        group_id: args.group_id,
        thread_root_message_index: args.thread_root_message_index,
        community_name: state.data.name.clone(),
        group_name,
        added_by: user_id,
        added_by_name: args.username,
        message,
        reaction: args.reaction,
        timestamp: now,
    });

    state.push_notification(vec![recipient], notification);
}
