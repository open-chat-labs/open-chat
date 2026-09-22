use crate::guards::caller_is_hosted_user;
use crate::queries::check_replica_up_to_date;
use crate::{RuntimeState, read_state};
use canister_api_macros::query;
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
    check_replica_up_to_date(args.latest_known_update, state)?;

    state.with_caller_user(|my_index, user| user_core::queries::messages_by_message_index(user, args, state.user_id(my_index)))
}
