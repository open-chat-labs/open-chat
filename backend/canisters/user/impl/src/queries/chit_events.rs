use crate::guards::caller_is_owner;
use crate::read_state;
use canister_api_macros::query;
use user_canister::chit_events::*;

#[query(guard = "caller_is_owner", msgpack = true)]
fn chit_events(args: Args) -> Response {
    read_state(|state| Response::Success(user_core::queries::chit_events(&state.data.user, args)))
}
