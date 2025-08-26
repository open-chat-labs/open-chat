use crate::queries::check_replica_up_to_date;
use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use community_canister::messages_by_message_index::{Response::*, *};
use oc_error_codes::OCErrorCode;
use types::{EventsCaller, MessagesResponse, OCResult};

#[query(msgpack = true)]
fn messages_by_message_index(args: Args) -> Response {
    match read_state(|state| messages_by_message_index_impl(args, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn messages_by_message_index_impl(args: Args, state: &RuntimeState) -> OCResult<MessagesResponse> {
    if let Err(now) = check_replica_up_to_date(args.latest_known_update, state) {
        return Err(OCErrorCode::ReplicaNotUpToDate.with_message(now));
    }

    let caller = state.env.caller();
    let user_id = state.data.members.get(caller).map(|m| m.user_id);

    if user_id.is_none() && (!state.data.is_public.value || state.data.has_payment_gate()) {
        return Err(OCErrorCode::InitiatorNotInCommunity.into());
    }

    let events_caller = user_id.map_or(EventsCaller::Unknown, EventsCaller::User);
    let channel = state.data.channels.get_or_err(&args.channel_id)?;

    channel
        .chat
        .messages_by_message_index(events_caller, args.thread_root_message_index, args.messages)
}
