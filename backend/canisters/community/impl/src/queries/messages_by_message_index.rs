use crate::{read_state, RuntimeState};
use chat_events::Reader;
use community_canister::messages_by_message_index::{Response::*, *};
use ic_cdk_macros::query;

#[query]
fn messages_by_message_index(args: Args) -> Response {
    read_state(|state| messages_by_message_index_impl(args, state))
}

fn messages_by_message_index_impl(args: Args, state: &RuntimeState) -> Response {
    let caller = state.env.caller();
    let user_id = state.data.members.get(caller).map(|m| m.user_id);

    if !state.data.is_public && user_id.is_none() {
        return CallerNotInCommunity;
    }

    if let Some(channel) = state.data.channels.get(&args.channel_id) {
        if let Some(min_visible_event_index) = channel.chat.min_visible_event_index(user_id) {
            let now = state.env.now();

            if let Some(events_reader) =
                channel
                    .chat
                    .events
                    .events_reader(min_visible_event_index, args.thread_root_message_index, now)
            {
                let latest_event_index = events_reader.latest_event_index().unwrap();

                if args.latest_client_event_index.map_or(false, |e| latest_event_index < e) {
                    return ReplicaNotUpToDate(latest_event_index);
                }

                let messages: Vec<_> = args
                    .messages
                    .into_iter()
                    .filter_map(|m| events_reader.message_event(m.into(), user_id))
                    .collect();

                Success(SuccessResult {
                    messages,
                    latest_event_index,
                })
            } else {
                ThreadNotFound
            }
        } else {
            UserNotInChannel
        }
    } else {
        ChannelNotFound
    }
}
