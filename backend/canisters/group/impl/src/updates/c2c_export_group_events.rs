use crate::guards::caller_is_community_being_imported_into;
use crate::RuntimeState;
use crate::{read_state, run_regular_jobs};
use canister_api_macros::update;
use group_canister::c2c_export_group_events::{Response::*, *};

#[update(guard = "caller_is_community_being_imported_into", msgpack = true)]
fn c2c_export_group_events(args: Args) -> Response {
    run_regular_jobs();

    read_state(|state| c2c_export_group_events_impl(args, state))
}

fn c2c_export_group_events_impl(args: Args, state: &RuntimeState) -> Response {
    let mut events = state.data.chat.events.read_events_as_bytes_from_stable_memory(args.after);

    // Exclude the latest event since that is the GroupFrozen event which we don't want to transfer
    // to the community
    let latest_event_index = state.data.chat.events.latest_event_index().unwrap();
    events.retain(|(e, _)| e.thread_root_message_index.is_some() || e.event_index < latest_event_index);

    Success(SuccessResult {
        finished: events.is_empty(),
        events,
    })
}
