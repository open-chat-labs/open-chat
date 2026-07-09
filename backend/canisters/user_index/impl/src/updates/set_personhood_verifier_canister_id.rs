use crate::guards::caller_is_governance_principal;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_index_canister::set_personhood_verifier_canister_id::*;

#[update(guard = "caller_is_governance_principal", msgpack = true)]
#[trace]
fn set_personhood_verifier_canister_id(args: Args) -> Response {
    mutate_state(|state| set_personhood_verifier_canister_id_impl(args, state))
}

fn set_personhood_verifier_canister_id_impl(args: Args, state: &mut RuntimeState) -> Response {
    state.data.personhood_verifier_canister_id = args.canister_id;
    Response::Success
}
