use crate::guards::caller_is_deployment_operator;
use crate::mutate_state;
use crate::RuntimeState;
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use translations_canister::mark_deployed::{Response::*, *};

#[update(guard = "caller_is_deployment_operator")]
#[trace]
fn mark_deployed(args: Args) -> Response {
    mutate_state(|state| mark_deployed_impl(args, state))
}

fn mark_deployed_impl(args: Args, state: &mut RuntimeState) -> Response {
    state.data.translations.mark_deployed(args.latest_approval, state.env.now());
    Success
}
