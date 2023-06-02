use crate::guards::caller_is_platform_moderator;
use crate::{read_state, RuntimeState};
use ic_cdk_macros::query;
use user_index_canister::suspected_bots::{Response::*, *};

#[query(guard = "caller_is_platform_moderator")]
fn suspected_bots(args: Args) -> Response {
    read_state(|state| suspected_bots_impl(args, state))
}

fn suspected_bots_impl(args: Args, state: &RuntimeState) -> Response {
    Success(SuccessResult {
        users: state.data.users.suspected_bots(args.after, args.count as usize),
    })
}
