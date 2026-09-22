use crate::guards::caller_is_owner;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::OCResult;
use user_canister::set_contact::*;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn set_contact(args: Args) -> Response {
    execute_update(|state| set_contact_impl(args, state)).into()
}

fn set_contact_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    user_core::updates::set_contact::set_contact(&mut state.data.user, args)
}
