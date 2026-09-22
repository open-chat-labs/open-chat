use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::OCResult;
use user_canister::set_contact::*;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn set_contact(args: Args) -> Response {
    mutate_state(|state| set_contact_impl(args, state)).into()
}

fn set_contact_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.with_caller_user_mut(|_, user| user_core::updates::set_contact(user, args))
}
