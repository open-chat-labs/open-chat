use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_local_user_index;
use crate::linked_users::on_linked_user_found;
use crate::{CommunityEventPusher, RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::{add_reaction::*, c2c_bot_add_reaction};
use multi_user_canister::{CommunityCanisterEvent, MessageActivity, MessageActivityEvent};
use oc_error_codes::OCErrorCode;
use types::{
    Achievement, BotCaller, BotPermissions, Caller, ChannelId, ChannelReactionAddedNotification,
    ChannelUserNotificationPayload, Chat, ChatPermission, CommunityId, EventIndex, MessageId, MessageIndex, OCResult, Reaction,
    UserId,
};

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
        bridged_from: None,
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
    let caller = state.verified_caller(ext_caller)?;
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

    let message = result.value;
    let reaction = ReactionAdded {
        channel_id: args.channel_id,
        thread_root_message_index: args.thread_root_message_index,
        message_index: message.message_index,
        message_id: message.message_id,
        event_index: result.event_index,
        added_by: agent,
        added_by_name: args.username,
        added_by_display_name: args.display_name,
        reaction: args.reaction,
        new_achievement: args.new_achievement,
    };
    match message.bridged_from() {
        Some(account) => on_linked_user_found(account, state, move |linked_user, state| {
            tell_author(linked_user, reaction, state)
        }),
        None => tell_author(message.sender, reaction, state),
    }

    state.push_bot_notification(result.bot_notification);
    handle_activity_notification(state);
    Ok(())
}

struct ReactionAdded {
    channel_id: ChannelId,
    thread_root_message_index: Option<MessageIndex>,
    message_index: MessageIndex,
    message_id: MessageId,
    event_index: EventIndex,
    added_by: UserId,
    added_by_name: String,
    added_by_display_name: Option<String>,
    reaction: Reaction,
    new_achievement: bool,
}

// Tells whoever the message is shown as from of the reaction, if they're in the channel, unless they
// added it themselves or are a bot. That's its sender, or for a message a bridge bot relayed,
// whoever linked the account it came from.
fn tell_author(author: UserId, reaction: ReactionAdded, state: &mut RuntimeState) {
    let Some(channel) = state.data.channels.get(&reaction.channel_id) else {
        return;
    };
    let Some(member) = channel.chat.members.get(&author) else {
        return;
    };
    if author == reaction.added_by || member.user_type().is_bot() {
        return;
    }

    let community_id: CommunityId = state.env.canister_id().into();
    let now = state.env.now();

    if !member.notifications_muted().value && !member.suspended().value {
        let display_name = state
            .data
            .members
            .get_by_user_id(&reaction.added_by)
            .and_then(|m| m.display_name().value.clone())
            .or(reaction.added_by_display_name);
        let channel_avatar_id = channel.chat.avatar.as_ref().map(|d| d.id);

        let notification = ChannelUserNotificationPayload::ChannelReactionAdded(ChannelReactionAddedNotification {
            community_id,
            channel_id: reaction.channel_id,
            thread_root_message_index: reaction.thread_root_message_index,
            message_index: reaction.message_index,
            message_event_index: reaction.event_index,
            community_name: state.data.name.value.clone(),
            channel_name: channel.chat.name.value.clone(),
            added_by: reaction.added_by,
            added_by_name: reaction.added_by_name,
            added_by_display_name: display_name,
            reaction: reaction.reaction,
            community_avatar_id: state.data.avatar.as_ref().map(|d| d.id),
            channel_avatar_id,
        });

        state.push_notification(Some(reaction.added_by), vec![author], notification);
    }

    state.push_event_to_user(
        author,
        CommunityCanisterEvent::MessageActivity(MessageActivityEvent {
            chat: Chat::Channel(community_id, reaction.channel_id),
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

    if reaction.new_achievement {
        state.notify_user_of_achievement(reaction.added_by, Achievement::ReactedToMessage, now);
    }
}
