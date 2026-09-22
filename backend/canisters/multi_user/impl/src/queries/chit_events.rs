use crate::guards::caller_is_hosted_user;
use crate::read_state;
use canister_api_macros::query;
use user_canister::chit_events::*;

#[query(guard = "caller_is_hosted_user", msgpack = true)]
fn chit_events(args: Args) -> Response {
    read_state(|state| state.with_caller_user(|_, user| Response::Success(user_core::queries::chit_events(user, args))))
}
