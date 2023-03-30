use crate::guards::caller_is_platform_operator;
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use tracing::info;
use user_index_canister::set_initial_airdrop_open::{Response::*, *};

#[update(guard = "caller_is_platform_operator")]
#[trace]
async fn set_initial_airdrop_open(args: Args) -> Response {
    mutate_state(|state| set_initial_airdrop_open_impl(args, state))
}

fn set_initial_airdrop_open_impl(args: Args, state: &mut RuntimeState) -> Response {
    state.data.initial_airdrop_open = args.open;

    let text = if args.open { "open" } else { "closed" };

    info!("Initial airdrop set to {text}");
    Success
}
