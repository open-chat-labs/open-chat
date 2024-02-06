use crate::{delegation_signature_msg_hash, mutate_state, Delegation, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use identity_canister::prepare_delegation::{Response::*, *};
use types::Milliseconds;
use utils::time::{DAY_IN_MS, NANOS_PER_MILLISECOND};

const DEFAULT_EXPIRATION_PERIOD: Milliseconds = 30 * DAY_IN_MS;
const MAX_EXPIRATION_PERIOD: Milliseconds = 90 * DAY_IN_MS;

#[update]
#[trace]
fn prepare_delegation(args: Args) -> Response {
    mutate_state(|state| prepare_delegation_impl(args, state))
}

fn prepare_delegation_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();

    let Some(user) = state.data.user_principals.get_by_auth_principal(&caller) else {
        return NotFound;
    };

    let seed = state.data.calculate_seed(user.index);
    let delta = Milliseconds::min(
        args.max_time_to_live.unwrap_or(DEFAULT_EXPIRATION_PERIOD),
        MAX_EXPIRATION_PERIOD,
    );

    let expiration = state.env.now().saturating_add(delta);
    let delegation = Delegation {
        pubkey: args.session_key,
        expiration: expiration * NANOS_PER_MILLISECOND,
    };
    let msg_hash = delegation_signature_msg_hash(&delegation);

    state.data.signature_map.add_signature(&seed, msg_hash);
    state.data.update_root_hash();

    Success(delegation)
}
