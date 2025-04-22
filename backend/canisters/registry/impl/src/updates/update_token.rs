use crate::guards::caller_is_governance_principal;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use registry_canister::update_token::{Response::*, *};

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
fn update_token(args: Args) -> Response {
    mutate_state(|state| update_token_impl(args, state))
}

fn update_token_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    if state.data.tokens.update(args, now) { Success } else { TokenNotFound }
}
