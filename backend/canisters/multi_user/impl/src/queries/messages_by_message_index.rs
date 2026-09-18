use crate::guards::caller_is_hosted_user;
use crate::queries::check_replica_up_to_date;
use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use chat_events::Reader;
use oc_error_codes::OCErrorCode;
use types::{MessagesResponse, OCResult};
use user_canister::messages_by_message_index::{Response::*, *};

#[query(guard = "caller_is_hosted_user", msgpack = true)]
fn messages_by_message_index(args: Args) -> Response {
    match read_state(|state| messages_by_message_index_impl(args, state)) {
        Ok(response) => Success(response),
        Err(error) => Error(error),
    }
}

fn messages_by_message_index_impl(args: Args, state: &RuntimeState) -> OCResult<MessagesResponse> {
    if let Err(now) = check_replica_up_to_date(args.latest_known_update, state) {
        return Err(OCErrorCode::ReplicaNotUpToDate.with_message(now));
    }

    state.with_caller_user(|my_index, user| {
        let my_user_id = state.user_id(my_index);
        let chat = user.direct_chats.get_or_err(&args.user_id.into())?;
        let events_reader = chat
            .events_reader(args.thread_root_message_index)
            .ok_or(OCErrorCode::ThreadNotFound)?;

        let messages: Vec<_> = args
            .messages
            .into_iter()
            .filter_map(|m| events_reader.message_event(m.into(), Some(my_user_id)))
            .collect();

        Ok(MessagesResponse {
            messages,
            latest_event_index: events_reader.latest_event_index().unwrap(),
            chat_last_updated: chat.last_updated(),
        })
    })
}
