use crate::guards::caller_is_admin;
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use group_prize_bot::add_groups::{Response::*, *};

#[update(guard = "caller_is_admin")]
#[trace]
fn add_groups(args: Args) -> Response {
    mutate_state(|state| add_groups_impl(args, state))
}

fn add_groups_impl(args: Args, state: &mut RuntimeState) -> Response {
    if let Some(config) = state.data.config {
        for group in args.groups {
            config.groups.insert(group);
        }
        Success    
    } else {
        Uninitialized
    }
}
