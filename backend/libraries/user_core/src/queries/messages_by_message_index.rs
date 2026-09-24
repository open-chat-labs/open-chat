use crate::User;
use chat_events::Reader;
use oc_error_codes::OCErrorCode;
use types::{MessagesResponse, OCResult, UserId, UserIdAndPrincipal};
use user_canister::messages_by_message_index::Args;

// The caller checks the replica is up to date first
pub fn messages_by_message_index(user: &User, args: Args, my_user_id: UserId) -> OCResult<MessagesResponse> {
    let chat = user.direct_chats.get_or_err(&args.user_id.into())?;
    let events_reader = chat
        .events_reader(args.thread_root_message_index)
        .ok_or(OCErrorCode::ThreadNotFound)?;

    let me = UserIdAndPrincipal::new(my_user_id, user.principal);
    let messages: Vec<_> = args
        .messages
        .into_iter()
        .filter_map(|m| events_reader.message_event(m.into(), Some(me)))
        .collect();

    Ok(MessagesResponse {
        messages,
        latest_event_index: events_reader.latest_event_index().unwrap(),
        chat_last_updated: chat.last_updated(),
    })
}
