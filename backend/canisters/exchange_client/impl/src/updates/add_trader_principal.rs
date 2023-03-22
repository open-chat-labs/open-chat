use crate::guards::caller_is_governance_principal;
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use exchange_client_canister::add_trader_principal::{Response::*, *};
use ic_cdk_macros::update;

#[update(guard = "caller_is_governance_principal")]
#[trace]
fn add_trader_principal(args: Args) -> Response {
    mutate_state(|state| add_trader_principal_impl(args, state))
}

fn add_trader_principal_impl(args: Args, state: &mut RuntimeState) -> Response {
    let exchange_ids = state.data.trader_principals.entry(args.principal).or_default();
    for exchange_id in args.exchange_ids {
        exchange_ids.insert(exchange_id);
    }
    Success
}
