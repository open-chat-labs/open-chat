use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use user_index_canister::accept_terms::*;

// Bump alongside the frontend CURRENT_TERMS_VERSION whenever the terms change. Acceptance is
// clamped to this so a client cannot pre-accept future terms (eg. u32::MAX) and suppress
// every future notice.
pub const CURRENT_TERMS_VERSION: u32 = 1;

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
    if state
        .data
        .users
        .accept_terms(&caller, args.version.min(CURRENT_TERMS_VERSION), now)
    {
        Response::Success
    } else {
        Response::Error(OCErrorCode::InitiatorNotFound.into())
    }
}
