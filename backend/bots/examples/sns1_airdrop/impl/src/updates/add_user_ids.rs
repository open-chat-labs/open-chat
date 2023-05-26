use crate::guards::caller_is_admin;
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use sns1_airdrop::add_user_ids::{Response::*, *};

#[update(guard = "caller_is_admin")]
#[trace]
fn add_user_ids(args: Args) -> Response {
    mutate_state(|state| add_user_ids_impl(args, state))
}

fn add_user_ids_impl(args: Args, state: &mut RuntimeState) -> Response {
    for user_id in args.user_ids {
        state.data.users.entry(user_id).or_insert(None);
    }
    Success
}
