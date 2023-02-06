use crate::guards::caller_is_admin;
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use group_prize_bot::remove_groups::{Response::*, *};
use ic_cdk_macros::update;

#[update(guard = "caller_is_admin")]
#[trace]
fn remove_groups(args: Args) -> Response {
    mutate_state(|state| remove_groups_impl(args, state))
}

fn remove_groups_impl(args: Args, state: &mut RuntimeState) -> Response {
    if let Some(prize_data) = &mut state.data.prize_data {
        for group in args.groups {
            prize_data.groups.remove(&group);
        }
        Success
    } else {
        Uninitialized
    }
}
