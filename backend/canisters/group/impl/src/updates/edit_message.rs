use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_local_user_index;
use crate::{GroupEventPusher, RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::EditMessageArgs;
use group_canister::c2c_bot_edit_message;
use group_canister::edit_message_v2::*;
use oc_error_codes::OCErrorCode;
use types::{
    Achievement, BotPermissions, EventIndex, MessageContentInitial, MessageId, MessageIndex, OCResult, OgPreview, UserId,
};

#[update(msgpack = true)]
#[trace]
fn edit_message_v2(args: Args) -> Response {
    execute_update(|state| edit_message_impl(args, state)).into()
}

fn edit_message_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let member = state.get_calling_member(None, true)?;
    let now = state.env.now();
    let sender = member.user_id();
    let is_bot = member.user_type().is_bot();

    commit(
        sender,
        member.min_visible_event_index(),
        args.thread_root_message_index,
        args.message_id,
        args.content,
        args.block_level_markdown,
        args.og_previews,
        state,
    )?;

    if args.new_achievement && !is_bot {
        state.notify_user_of_achievement(sender, Achievement::EditedMessage, now);
    }

    Ok(())
}

// For now only bridge bots can do this, which the LocalUserIndex checks, to relay the edits made on
// the other platform to the messages they relayed
#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_bot_edit_message(args: c2c_bot_edit_message::Args) -> c2c_bot_edit_message::Response {
    execute_update(|state| c2c_bot_edit_message_impl(args, state)).into()
}

fn c2c_bot_edit_message_impl(args: c2c_bot_edit_message::Args, state: &mut RuntimeState) -> OCResult {
    let content: MessageContentInitial = args.content.into();

    if !state.data.is_bot_permitted(
        &args.bot_id,
        &args.initiator,
        &BotPermissions::from_message_permission((&content).into()),
    ) {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    // The bot isn't a member, and sees the whole chat. It can only edit its own messages, since the
    // edit is made as it.
    commit(
        args.bot_id,
        EventIndex::default(),
        args.thread,
        args.message_id,
        content,
        Some(args.block_level_markdown),
        args.og_previews,
        state,
    )
}

#[expect(clippy::too_many_arguments)]
fn commit(
    sender: UserId,
    min_visible_event_index: EventIndex,
    thread_root_message_index: Option<MessageIndex>,
    message_id: MessageId,
    content: MessageContentInitial,
    block_level_markdown: Option<bool>,
    og_previews: Vec<OgPreview>,
    state: &mut RuntimeState,
) -> OCResult {
    let now = state.env.now();

    let edit_message_args = EditMessageArgs {
        sender,
        min_visible_event_index,
        thread_root_message_index,
        message_id,
        content: content.into(),
        block_level_markdown,
        og_previews,
        finalise_bot_message: false,
        now,
    };

    let result = state.data.chat.events.edit_message(
        edit_message_args,
        Some(GroupEventPusher {
            now,
            rng: state.env.rng(),
            queue: &mut state.data.local_user_index_event_sync_queue,
        }),
    )?;

    // Re-classify the edited content
    if state.data.chat.is_public.value
        && let Some((message, _)) =
            state
                .data
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
        state.queue_message_for_moderation(thread_root_message_index, message_id, input);
        if !blobs.is_empty() {
            state.queue_media_for_scanning(thread_root_message_index, message_id, blobs);
        }
    }

    state.push_bot_notification(result.bot_notification);
    handle_activity_notification(state);
    Ok(())
}
