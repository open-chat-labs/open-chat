use crate::guards::caller_is_group_index_canister;
use crate::reinstall_group::reinstall_group;
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use local_group_index_canister::c2c_reinstall_group::{Response::*, *};

#[update_msgpack(guard = "caller_is_group_index_canister")]
#[trace]
async fn c2c_reinstall_group(args: Args) -> Response {
    match reinstall_group(args.group_id).await {
        Ok(()) => Success,
        Err(error) => InternalError(error),
    }
}
