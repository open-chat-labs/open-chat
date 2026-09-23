use crate::guards::caller_is_owner;
use crate::{execute_update_async, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::OCResult;
use user_canister::approve_transfer::*;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
async fn approve_transfer(args: Args) -> Response {
    execute_update_async(|| approve_transfer_impl(args)).await.into()
}

async fn approve_transfer_impl(mut args: Args) -> OCResult {
    let now_nanos = mutate_state(|state| {
        let now = state.env.now();
        user_core::updates::approve_transfer::prepare(&mut state.data.user, &mut args, now)
    })?;

    user_core::updates::approve_transfer::approve(args, now_nanos).await
}
