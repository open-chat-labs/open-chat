use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_local_user_index;
use crate::{GroupEventPusher, RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::{add_reaction::*, c2c_bot_add_reaction};
use oc_error_codes::{OCError, OCErrorCode};
use types::{
    Achievement, BotCaller, BotPermissions, Caller, Chat, ChatPermission, EventIndex, GroupReactionAddedNotification, OCResult,
    UserNotificationPayload,
};
use user_canister::{GroupCanisterEvent, MessageActivity, MessageActivityEvent};

#[update(candid = true, msgpack = true)]
#[trace]
fn add_reaction(args: Args) -> Response {
    execute_update(|state| add_reaction_impl(args, None, state)).into()
}

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_bot_add_reaction(args: c2c_bot_add_reaction::Args) -> c2c_bot_add_reaction::Response {
    execute_update(|state| c2c_bot_add_reaction_impl(args, state))
}

fn c2c_bot_add_reaction_impl(args: c2c_bot_add_reaction::Args, state: &mut RuntimeState) -> c2c_bot_add_reaction::Response {
    let bot_caller = BotCaller {
        bot: args.bot_id,
        initiator: args.initiator.clone(),
    };

    let args = Args {
        thread_root_message_index: args.thread,
        message_id: args.message_id,
        reaction: args.reaction,
        username: args.bot_name,
        display_name: None,
        new_achievement: false,
        correlation_id: 0,
    };

    if !state.data.is_bot_permitted(
        &bot_caller.bot,
        &bot_caller.initiator,
        &BotPermissions::from_chat_permission(ChatPermission::ReactToMessages),
    ) {
        return OCError::from(OCErrorCode::InitiatorNotAuthorized).into();
    }

    add_reaction_impl(args, Some(Caller::BotV2(bot_caller)), state).into()
}

fn add_reaction_impl(args: Args, ext_caller: Option<Caller>, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let caller = state.verified_caller(ext_caller)?;
    let agent = caller.agent();
    let now = state.env.now();
    let thread_root_message_index = args.thread_root_message_index;

    state.data.chat.add_reaction(
        caller,
        args.thread_root_message_index,
        args.message_id,
        args.reaction.clone(),
        now,
        GroupEventPusher {
            now,
            rng: state.env.rng(),
            queue: &mut state.data.local_user_index_event_sync_queue,
        },
    )?;

    if let Some((message, event_index)) =
        state
            .data
            .chat
            .events
            .message_internal(EventIndex::default(), thread_root_message_index, args.message_id.into())
    {
        if let Some(sender) = state.data.chat.members.get(&message.sender) {
            if message.sender != agent && !sender.user_type().is_bot() {
                let chat_id = state.env.canister_id().into();

                let notifications_muted = state
                    .data
                    .chat
                    .members
                    .get(&message.sender)
                    .is_none_or(|p| p.notifications_muted().value || p.suspended().value);

                if !notifications_muted {
                    state.push_notification(
                        Some(agent),
                        vec![message.sender],
                        UserNotificationPayload::GroupReactionAdded(GroupReactionAddedNotification {
                            chat_id,
                            thread_root_message_index,
                            message_index: message.message_index,
                            message_event_index: event_index,
                            group_name: state.data.chat.name.value.clone(),
                            added_by: agent,
                            added_by_name: args.username,
                            added_by_display_name: args.display_name,
                            reaction: args.reaction,
                            group_avatar_id: state.data.chat.avatar.as_ref().map(|d| d.id),
                        }),
                    );
                }

                state.push_event_to_user(
                    message.sender,
                    GroupCanisterEvent::MessageActivity(MessageActivityEvent {
                        chat: Chat::Group(chat_id),
                        thread_root_message_index,
                        message_index: message.message_index,
                        message_id: message.message_id,
                        event_index,
                        activity: MessageActivity::Reaction,
                        timestamp: state.env.now(),
                        user_id: Some(agent),
                    }),
                    now,
                );

                state.notify_user_of_achievement(message.sender, Achievement::HadMessageReactedTo, now);
            }
        }

        if args.new_achievement {
            state.notify_user_of_achievement(agent, Achievement::ReactedToMessage, now);
        }
    }

    handle_activity_notification(state);
    Ok(())
}
