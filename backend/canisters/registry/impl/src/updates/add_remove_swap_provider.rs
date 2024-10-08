use crate::{mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use registry_canister::add_remove_swap_provider::{Response::*, *};
use user_index_canister_c2c_client::{lookup_user, LookupUserError};

#[update(msgpack = true)]
#[trace]
async fn add_remove_swap_provider(args: Args) -> Response {
    let (caller, user_index_canister_id) = read_state(|state| (state.env.caller(), state.data.user_index_canister_id));

    match lookup_user(caller, user_index_canister_id).await {
        Ok(user) if user.is_platform_operator => (),
        Ok(_) | Err(LookupUserError::UserNotFound) => return NotAuthorized,
        Err(LookupUserError::InternalError(error)) => return InternalError(error),
    }

    mutate_state(|state| {
        state.data.swap_providers.update(
            |p| if args.add { p.insert(args.swap_provider) } else { p.remove(&args.swap_provider) },
            state.env.now(),
        )
    });

    Success
}
