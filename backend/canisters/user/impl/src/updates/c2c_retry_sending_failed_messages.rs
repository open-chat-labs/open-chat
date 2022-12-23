use crate::guards::caller_is_user_index;
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use user_canister::c2c_retry_sending_failed_messages::{Response::*, *};

#[update_msgpack(guard = "caller_is_user_index")]
#[trace]
fn c2c_retry_sending_failed_messages(_args: Args) -> Response {
    Success
}
