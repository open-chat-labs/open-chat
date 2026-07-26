use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use user_index_canister::accept_terms::*;

// Records the user's acceptance of the platform terms (an affirmative click on the
// terms-updated notice). The version and timestamp are kept as evidence of acceptance.
#[update(msgpack = true)]
#[trace]
fn accept_terms(args: Args) -> Response {
    mutate_state(|state| accept_terms_impl(args, state))
}

fn accept_terms_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    let now = state.env.now();
    if state.data.users.accept_terms(&caller, args.version, now) {
        Response::Success
    } else {
        Response::Error(OCErrorCode::InitiatorNotFound.into())
    }
}
