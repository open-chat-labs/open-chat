use crate::guards::caller_is_governance_principal;
use crate::{mutate_state, State};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use cycles_dispenser_canister::update_config::{Response::*, *};

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
fn update_config(args: Args) -> Response {
    mutate_state(|state| update_config_impl(args, state))
}

fn update_config_impl(args: Args, state: &mut State) -> Response {
    if let Some(max_top_up_amount) = args.max_top_up_amount {
        state.data.max_top_up_amount = max_top_up_amount;
    }
    if let Some(min_interval) = args.min_interval {
        state.data.min_interval = min_interval;
    }
    if let Some(min_cycles_balance) = args.min_cycles_balance {
        state.data.min_cycles_balance = min_cycles_balance;
    }
    if let Some(icp_burn_amount) = args.icp_burn_amount {
        state.data.icp_burn_amount = icp_burn_amount;
    }
    Success
}
