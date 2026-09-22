use crate::guards::caller_is_local_user_index;
use crate::read_state;
use canister_api_macros::query;
use user_canister::c2c_bot_chat_summary::*;

#[query(guard = "caller_is_local_user_index", msgpack = true)]
fn c2c_bot_chat_summary(args: Args) -> Response {
    match read_state(|state| user_core::queries::c2c_bot_chat_summary(&state.data.user, &args)) {
        Ok(details) => Response::Success(details),
        Err(error) => Response::Error(error),
    }
}
