use crate::guards::caller_is_owner_or_local_user_index;
use crate::model::direct_chat::DirectChat;
use crate::queries::check_replica_up_to_date;
use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use chat_events::{ChatEventsListReader, Reader};
use types::{EventIndex, EventOrExpiredRange, EventsResponse, MessageIndex, TimestampMillis, UserId};
use user_canister::events::{Response::*, *};

#[query(guard = "caller_is_owner_or_local_user_index", candid = true, msgpack = true)]
fn events(args: Args) -> Response {
    read_state(|state| {
        read_events(
            args.latest_known_update,
            args.user_id,
            args.thread_root_message_index,
            args,
            events_impl,
            state,
        )
    })
}

fn events_impl(args: Args, my_user_id: UserId, events_reader: ChatEventsListReader) -> Vec<EventOrExpiredRange> {
    events_reader.scan(
        Some(args.start_index.into()),
        args.ascending,
        args.max_messages as usize,
        args.max_events as usize,
        Some(my_user_id),
    )
}

pub(crate) fn read_events<A, F: FnOnce(A, UserId, ChatEventsListReader) -> Vec<EventOrExpiredRange>>(
    latest_known_update: Option<TimestampMillis>,
    user_id: UserId,
    thread_root_message_index: Option<MessageIndex>,
    args: A,
    get_events_fn: F,
    state: &RuntimeState,
) -> Response {
    let PrepareResult {
        chat,
        events_reader,
        my_user_id,
    } = match prepare(latest_known_update, user_id, thread_root_message_index, state) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let latest_event_index = events_reader.latest_event_index().unwrap_or_default();
    let events_response = get_events_fn(args, my_user_id, events_reader);

    process_events(events_response, chat, latest_event_index)
}

pub(crate) struct PrepareResult<'a> {
    pub chat: &'a DirectChat,
    pub events_reader: ChatEventsListReader<'a>,
    pub my_user_id: UserId,
}

fn prepare(
    latest_known_update: Option<TimestampMillis>,
    user_id: UserId,
    thread_root_message_index: Option<MessageIndex>,
    state: &RuntimeState,
) -> Result<PrepareResult, Response> {
    if let Err(now) = check_replica_up_to_date(latest_known_update, state) {
        return Err(ReplicaNotUpToDateV2(now));
    }

    let Some(chat) = state.data.direct_chats.get(&user_id.into()) else {
        return Err(ChatNotFound);
    };

    if let Some(events_reader) = chat.events.events_reader(EventIndex::default(), thread_root_message_index) {
        Ok(PrepareResult {
            chat,
            events_reader,
            my_user_id: state.env.canister_id().into(),
        })
    } else {
        Err(ThreadMessageNotFound)
    }
}

fn process_events(events_response: Vec<EventOrExpiredRange>, chat: &DirectChat, latest_event_index: EventIndex) -> Response {
    let (events, expired_event_ranges) = EventOrExpiredRange::split(events_response);
    let expired_message_ranges = chat.events.convert_to_message_ranges(&expired_event_ranges);
    let chat_last_updated = chat.last_updated();

    Success(EventsResponse {
        events,
        expired_event_ranges,
        expired_message_ranges,
        latest_event_index,
        chat_last_updated,
    })
}
