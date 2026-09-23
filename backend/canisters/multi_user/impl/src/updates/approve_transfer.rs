use crate::guards::caller_is_hosted_user;
use crate::mutate_state;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::OCResult;
use user_canister::approve_transfer::*;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
async fn approve_transfer(args: Args) -> Response {
    approve_transfer_impl(args).await.into()
}

async fn approve_transfer_impl(mut args: Args) -> OCResult {
    let now_nanos = mutate_state(|state| {
        let now = state.env.now();
        state.with_caller_user_mut(|_, user| user_core::updates::approve_transfer::prepare(user, &mut args, now))
    })?;

    user_core::updates::approve_transfer::approve(args, now_nanos).await
}
