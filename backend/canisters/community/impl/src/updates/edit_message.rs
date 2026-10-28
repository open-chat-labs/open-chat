use crate::guards::caller_is_local_user_index;
use crate::{CommunityEventPusher, RuntimeState, activity_notifications::handle_activity_notification, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::{EditMessageArgs, MessageEdit};
use community_canister::{c2c_bot_edit_message, edit_message, edit_message_text};
use oc_error_codes::OCErrorCode;
use types::{Achievement, BotPermissions, ChannelId, EventIndex, MessageContentInitial, OCResult};

#[update(msgpack = true)]
#[trace]
fn edit_message_text(args: edit_message_text::Args) -> edit_message_text::Response {
    execute_update(|state| edit_message_text_impl(args, state)).into()
}

// Older clients send the whole content, of which only the text is taken
#[update(msgpack = true)]
#[trace]
fn edit_message(args: edit_message::Args) -> edit_message::Response {
    let args = edit_message_text::Args {
        channel_id: args.channel_id,
        thread_root_message_index: args.thread_root_message_index,
        message_id: args.message_id,
        text: args.content.text().map(|t| t.to_string()),
        block_level_markdown: args.block_level_markdown,
        new_achievement: args.new_achievement,
        og_previews: args.og_previews,
    };
    execute_update(|state| edit_message_text_impl(args, state)).into()
}

fn edit_message_text_impl(args: edit_message_text::Args, state: &mut RuntimeState) -> OCResult {
    let member = state.get_calling_member(None, true)?;

    let Some(channel) = state.data.channels.get(&args.channel_id) else {
        return Err(OCErrorCode::ChatNotFound.into());
    };

    let sender = member.user_id;
    let min_visible_event_index = channel.chat.members.get_verified_member(sender)?.min_visible_event_index();

    commit(
        args.channel_id,
        EditMessageArgs {
            sender,
            min_visible_event_index,
            thread_root_message_index: args.thread_root_message_index,
            message_id: args.message_id,
            edit: MessageEdit::Text(args.text),
            block_level_markdown: args.block_level_markdown,
            og_previews: args.og_previews,
            finalise_bot_message: false,
            now: state.env.now(),
        },
        args.new_achievement,
        state,
    )
}

// A bot editing its own message, eg. a bridge bot relaying an edit made on the other platform
#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_bot_edit_message(args: c2c_bot_edit_message::Args) -> c2c_bot_edit_message::Response {
    execute_update(|state| c2c_bot_edit_message_impl(args, state)).into()
}

fn c2c_bot_edit_message_impl(args: c2c_bot_edit_message::Args, state: &mut RuntimeState) -> OCResult {
    let content: MessageContentInitial = args.content.into();

    if !state.data.is_bot_permitted(
        &args.bot_id,
        Some(args.channel_id),
        &args.initiator,
        &BotPermissions::from_message_permission((&content).into()),
    ) {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    let Some(channel) = state.data.channels.get(&args.channel_id) else {
        return Err(OCErrorCode::ChatNotFound.into());
    };
    channel
        .chat
        .events
        .check_bot_edit(args.thread, args.message_id, &content, state.env.now())?;

    // The bot isn't a member, and sees the whole chat. It can only edit its own messages, since the
    // edit is made as it.
    commit(
        args.channel_id,
        EditMessageArgs {
            sender: args.bot_id,
            min_visible_event_index: EventIndex::default(),
            thread_root_message_index: args.thread,
            message_id: args.message_id,
            edit: MessageEdit::Content(Box::new(content.into())),
            block_level_markdown: Some(args.block_level_markdown),
            og_previews: args.og_previews,
            finalise_bot_message: false,
            now: state.env.now(),
        },
        false,
        state,
    )
}

fn commit(channel_id: ChannelId, args: EditMessageArgs, new_achievement: bool, state: &mut RuntimeState) -> OCResult {
    let sender = args.sender;
    let thread_root_message_index = args.thread_root_message_index;
    let message_id = args.message_id;
    let now = args.now;

    let Some(channel) = state.data.channels.get_mut(&channel_id) else {
        return Err(OCErrorCode::ChatNotFound.into());
    };

    let result = channel.chat.events.edit_message(
        args,
        Some(CommunityEventPusher {
            now,
            rng: state.env.rng(),
            queue: &mut state.data.local_user_index_event_sync_queue,
        }),
    )?;

    if new_achievement {
        state.notify_user_of_achievement(sender, Achievement::EditedMessage, now);
    }

    // Re-classify the edited content
    if state.data.is_public.value
        && let Some(channel) = state.data.channels.get(&channel_id)
        && channel.chat.is_public.value
        && let Some((message, _)) =
            channel
                .chat
                .events
                .message_internal(EventIndex::default(), thread_root_message_index, message_id.into())
        && message.deleted_by.is_none()
    {
        // Sent even when there is nothing classifiable: an empty request makes the local index
        // dequeue the earlier content and reply with an empty classification, clearing any
        // stale flags left by text this edit removed
        let input = message.content.moderation_input();
        // Unlike classification there is no empty-request "clear" for media: verdicts only
        // ever act on a match, and a match escalates regardless of later edits (the matched
        // content was posted publicly; editing it away does not void the report)
        let blobs = message.content.scannable_blobs();
        state.queue_message_for_moderation(channel_id, thread_root_message_index, message_id, input);
        if !blobs.is_empty() {
            state.queue_media_for_scanning(channel_id, thread_root_message_index, message_id, blobs);
        }
    }

    state.push_bot_notification(result.bot_notification);
    handle_activity_notification(state);
    Ok(())
}
