use crate::guards::caller_is_local_user_index;
use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use oc_error_codes::OCErrorCode;
use types::{BotPermissions, ChatPermission, ChatSummaryDirect, EventIndex, OCResult};
use user_canister::c2c_bot_chat_summary::*;

#[query(guard = "caller_is_local_user_index", msgpack = true)]
fn c2c_bot_chat_summary(args: Args) -> Response {
    read_state(|state| match c2c_bot_chat_summary_impl(args, state) {
        Ok(details) => Response::Success(details),
        Err(error) => Response::Error(error),
    })
}

fn c2c_bot_chat_summary_impl(args: Args, state: &RuntimeState) -> OCResult<ChatSummaryDirect> {
    if !state.data.is_bot_permitted(
        &args.bot_id,
        &args.initiator,
        BotPermissions::from_chat_permission(ChatPermission::ReadChatDetails),
    ) {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    let chat = &state
        .data
        .direct_chats
        .get(&args.bot_id.into())
        .ok_or(OCErrorCode::ChatNotFound)?;

    let events_ttl = chat.events.get_events_time_to_live();
    let main_events_reader = chat.events.visible_main_events_reader(EventIndex::default());

    Ok(ChatSummaryDirect {
        last_updated: chat.last_updated(),
        latest_event_index: main_events_reader.latest_event_index().unwrap_or_default(),
        latest_message_index: main_events_reader.latest_message_index(),
        events_ttl: events_ttl.value,
        events_ttl_last_updated: if events_ttl.timestamp == 0 { None } else { Some(events_ttl.timestamp) },
        video_call_in_progress: chat.events.video_call_in_progress(None),
    })
}
