use crate::User;
use oc_error_codes::OCErrorCode;
use types::{BotPermissions, ChatPermission, ChatSummaryDirect, OCResult};
use user_canister::c2c_bot_chat_summary::Args;

// The summary of the user's chat with the bot, provided the bot may read it
pub fn c2c_bot_chat_summary(user: &User, args: &Args) -> OCResult<ChatSummaryDirect> {
    if !user.is_bot_permitted(
        &args.bot_id,
        &args.initiator,
        BotPermissions::from_chat_permission(ChatPermission::ReadSummary),
    ) {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    let chat = user.direct_chats.get(&args.bot_id.into()).ok_or(OCErrorCode::ChatNotFound)?;

    let events_ttl = chat.events().get_events_time_to_live();
    let main_events_reader = chat.main_events_reader();

    Ok(ChatSummaryDirect {
        last_updated: chat.last_updated(),
        latest_event_index: main_events_reader.latest_event_index().unwrap_or_default(),
        latest_message_index: main_events_reader.latest_message_index(),
        events_ttl: events_ttl.value,
        events_ttl_last_updated: if events_ttl.timestamp == 0 { None } else { Some(events_ttl.timestamp) },
        video_call_in_progress: chat.events().video_call_in_progress(None),
    })
}
