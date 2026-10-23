use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_local_user_index;
use crate::linked_users::on_linked_user_found;
use crate::{GroupEventPusher, RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::{add_reaction::*, c2c_bot_add_reaction};
use multi_user_canister::{GroupCanisterEvent, MessageActivity, MessageActivityEvent};
use oc_error_codes::{OCError, OCErrorCode};
use types::{
    Achievement, BotCaller, BotPermissions, Caller, Chat, ChatId, ChatPermission, EventIndex, GroupChatUserNotificationPayload,
    GroupReactionAddedNotification, MessageId, MessageIndex, OCResult, Reaction, UserId,
};

#[update(msgpack = true)]
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
        bridged_from: None,
    };

    let args = Args {
        thread_root_message_index: args.thread,
        message_id: args.message_id,
        reaction: args.reaction,
        username: args.bot_name,
        display_name: None,
        new_achievement: false,
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
    let caller = state.verified_caller(ext_caller)?;
    let agent = caller.agent();
    let now = state.env.now();
    let new_achievement = args.new_achievement;

    let result = state.data.chat.add_reaction(
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

    let message = result.value;
    let reaction = ReactionAdded {
        thread_root_message_index: args.thread_root_message_index,
        message_index: message.message_index,
        message_id: message.message_id,
        event_index: result.event_index,
        added_by: agent,
        added_by_name: args.username,
        added_by_display_name: args.display_name,
        reaction: args.reaction,
    };
    match message.bridged_from() {
        Some(account) => on_linked_user_found(account, state, move |linked_user, state| {
            tell_author(linked_user, reaction, state)
        }),
        None => tell_author(message.sender, reaction, state),
    }

    if new_achievement {
        state.notify_user_of_achievement(agent, Achievement::ReactedToMessage, now);
    }

    state.push_bot_notification(result.bot_notification);
    handle_activity_notification(state);
    Ok(())
}

struct ReactionAdded {
    thread_root_message_index: Option<MessageIndex>,
    message_index: MessageIndex,
    message_id: MessageId,
    event_index: EventIndex,
    added_by: UserId,
    added_by_name: String,
    added_by_display_name: Option<String>,
    reaction: Reaction,
}

// Tells whoever the message is shown as from of the reaction, if they're in the group, unless they
// added it themselves or are a bot. That's its sender, or for a message a bridge bot relayed,
// whoever linked the account it came from.
fn tell_author(author: UserId, reaction: ReactionAdded, state: &mut RuntimeState) {
    let Some(member) = state.data.chat.members.get(&author) else {
        return;
    };
    if author == reaction.added_by || member.user_type().is_bot() {
        return;
    }

    let chat_id: ChatId = state.env.canister_id().into();
    let now = state.env.now();

    if !member.notifications_muted().value && !member.suspended().value {
        let user_notification_payload = GroupChatUserNotificationPayload::GroupReactionAdded(GroupReactionAddedNotification {
            chat_id,
            thread_root_message_index: reaction.thread_root_message_index,
            message_index: reaction.message_index,
            message_event_index: reaction.event_index,
            group_name: state.data.chat.name.value.clone(),
            added_by: reaction.added_by,
            added_by_name: reaction.added_by_name,
            added_by_display_name: reaction.added_by_display_name,
            reaction: reaction.reaction,
            group_avatar_id: state.data.chat.avatar.as_ref().map(|d| d.id),
        });

        state.push_notification(Some(reaction.added_by), vec![author], user_notification_payload);
    }

    state.push_event_to_user(
        author,
        GroupCanisterEvent::MessageActivity(MessageActivityEvent {
            chat: Chat::Group(chat_id),
            thread_root_message_index: reaction.thread_root_message_index,
            message_index: reaction.message_index,
            message_id: reaction.message_id,
            event_index: reaction.event_index,
            activity: MessageActivity::Reaction,
            timestamp: now,
            user_id: Some(reaction.added_by),
        }),
        now,
    );

    state.notify_user_of_achievement(author, Achievement::HadMessageReactedTo, now);
}
