use crate::guards::caller_is_governance_principal;
use crate::{read_state, RuntimeState};
use ic_cdk_macros::query;
use user_index_canister::suspected_bots::{Response::*, *};

#[query(guard = "caller_is_governance_principal")]
fn suspected_bots(args: Args) -> Response {
    read_state(|state| suspected_bots_impl(args, state))
}

fn suspected_bots_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    Success(SuccessResult {
        users: runtime_state.data.users.suspected_bots(args.after, args.count as usize),
    })
}
