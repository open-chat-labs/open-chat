use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use group_canister::deleted_message::{Response::*, *};
use types::{MessageContent, OCResult};

#[query(msgpack = true)]
fn deleted_message(args: Args) -> Response {
    match read_state(|state| deleted_message_impl(args, state)) {
        Ok(content) => Success(SuccessResult { content }),
        Err(error) => Error(error),
    }
}

fn deleted_message_impl(args: Args, state: &RuntimeState) -> OCResult<MessageContent> {
    let user_id = state.get_caller_user_id()?;
    state
        .data
        .chat
        .deleted_message(user_id, args.thread_root_message_index, args.message_id)
}
