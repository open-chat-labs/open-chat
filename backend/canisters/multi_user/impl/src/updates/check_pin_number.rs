use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::check_pin_number::*;

// Checks the user's PIN ahead of a payment this canister will pull from their wallet, so that a
// payment with the wrong PIN is refused before the user approves it, and pays the approval's fee.
// The request which makes the payment checks the PIN again. A failed check counts towards the
// attempts allowed before the PIN is locked, as any other does, so this is no easier to guess with.
#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn check_pin_number(args: Args) -> Response {
    execute_update(|state| check_pin_number_impl(args, state))
}

fn check_pin_number_impl(mut args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    match state.with_caller_user_mut(|_, user| user.pin_number.verify(Some(&mut args.pin), now)) {
        Ok(()) => Response::Success,
        Err(error) => Response::Error(error.into()),
    }
}
