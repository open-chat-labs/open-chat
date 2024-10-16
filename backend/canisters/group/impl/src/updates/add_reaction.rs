use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::add_reaction::{Response::*, *};
use group_chat_core::AddRemoveReactionResult;
use types::{Achievement, Chat, EventIndex, GroupReactionAddedNotification, Notification};
use user_canister::{GroupCanisterEvent, MessageActivity, MessageActivityEvent};

#[update(candid = true, msgpack = true)]
#[trace]
fn add_reaction(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| add_reaction_impl(args, state))
}

fn add_reaction_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return ChatFrozen;
    }

    let caller = state.env.caller();
    if let Some(user_id) = state.data.lookup_user_id(caller) {
        let now = state.env.now();
        let thread_root_message_index = args.thread_root_message_index;

        match state.data.chat.add_reaction(
            user_id,
            args.thread_root_message_index,
            args.message_id,
            args.reaction.clone(),
            now,
            &mut state.data.event_store_client,
        ) {
            AddRemoveReactionResult::Success(sender) => {
                if let Some((message, event_index)) = state.data.chat.events.message_internal(
                    EventIndex::default(),
                    thread_root_message_index,
                    args.message_id.into(),
                ) {
                    let chat_id = state.env.canister_id().into();

                    if message.sender != user_id {
                        let notifications_muted = state
                            .data
                            .chat
                            .members
                            .get(&sender)
                            .map_or(true, |p| p.notifications_muted.value || p.suspended.value);

                        if !notifications_muted {
                            state.push_notification(
                                vec![sender],
                                Notification::GroupReactionAdded(GroupReactionAddedNotification {
                                    chat_id,
                                    thread_root_message_index,
                                    message_index: message.message_index,
                                    message_event_index: event_index,
                                    group_name: state.data.chat.name.value.clone(),
                                    added_by: user_id,
                                    added_by_name: args.username,
                                    added_by_display_name: args.display_name,
                                    reaction: args.reaction,
                                    group_avatar_id: state.data.chat.avatar.as_ref().map(|d| d.id),
                                }),
                            );
                        }
                    }

                    state.data.user_event_sync_queue.push(
                        sender,
                        GroupCanisterEvent::MessageActivity(MessageActivityEvent {
                            chat: Chat::Group(chat_id),
                            thread_root_message_index,
                            message_index: message.message_index,
                            activity: MessageActivity::Reaction,
                            timestamp: state.env.now(),
                            user_id: Some(user_id),
                        }),
                    );
                }

                if args.new_achievement {
                    state.data.notify_user_of_achievement(user_id, Achievement::ReactedToMessage);
                }

                state
                    .data
                    .notify_user_of_achievement(sender, Achievement::HadMessageReactedTo);

                handle_activity_notification(state);
                Success
            }
            AddRemoveReactionResult::NoChange => NoChange,
            AddRemoveReactionResult::InvalidReaction => InvalidReaction,
            AddRemoveReactionResult::MessageNotFound => MessageNotFound,
            AddRemoveReactionResult::UserNotInGroup => CallerNotInGroup,
            AddRemoveReactionResult::NotAuthorized => NotAuthorized,
            AddRemoveReactionResult::UserSuspended => UserSuspended,
            AddRemoveReactionResult::UserLapsed => UserLapsed,
        }
    } else {
        CallerNotInGroup
    }
}
