use crate::guards::caller_is_owner;
use crate::updates::remove_reaction::toggle_reaction;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::add_reaction::*;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn add_reaction(args: Args) -> Response {
    mutate_state(|state| add_reaction_impl(args, state)).into()
}

fn add_reaction_impl(args: Args, state: &mut RuntimeState) -> types::OCResult {
    toggle_reaction(
        args.user_id,
        args.thread_root_message_index,
        args.message_id,
        args.reaction,
        true,
        state,
    )
}
