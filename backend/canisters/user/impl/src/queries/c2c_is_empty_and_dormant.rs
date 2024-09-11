use crate::guards::caller_is_local_user_index;
use crate::read_state;
use canister_api_macros::query;
use user_canister::c2c_is_empty_and_dormant::*;

#[query(guard = "caller_is_local_user_index", msgpack = true)]
fn c2c_is_empty_and_dormant(_args: Args) -> Response {
    read_state(|state| state.is_empty_and_dormant())
}
