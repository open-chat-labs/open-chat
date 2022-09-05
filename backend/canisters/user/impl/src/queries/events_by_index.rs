use crate::guards::caller_is_owner;
use crate::{read_state, RuntimeState};
use ic_cdk_macros::query;
use user_canister::events_by_index::{Response::*, *};

#[query(guard = "caller_is_owner")]
fn events_by_index(args: Args) -> Response {
    read_state(|state| events_by_index_impl(args, state))
}

fn events_by_index_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    if let Some(chat) = runtime_state.data.direct_chats.get(&args.user_id.into()) {
        let latest_event_index = chat.events.main().last().index;

        if args.latest_client_event_index.map_or(false, |e| latest_event_index < e) {
            return ReplicaNotUpToDate(latest_event_index);
        }

        let my_user_id = runtime_state.env.canister_id().into();

        let chat_events = chat.events.main();
        let events = chat_events.get_by_index(args.events, Some(my_user_id));
        let affected_events = chat_events.affected_events(&events, Some(my_user_id));

        Success(SuccessResult {
            events,
            affected_events,
            latest_event_index,
        })
    } else {
        ChatNotFound
    }
}
