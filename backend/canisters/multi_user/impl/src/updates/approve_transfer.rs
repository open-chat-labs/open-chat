use crate::guards::caller_is_hosted_user;
use crate::mutate_state;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::{OCResult, UserId};
use user_canister::approve_transfer::*;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
async fn approve_transfer(args: Args) -> Response {
    approve_transfer_impl(args).await.into()
}

async fn approve_transfer_impl(mut args: Args) -> OCResult {
    let (my_user_id, now_nanos) = mutate_state(|state| {
        let now = state.env.now();
        let canister_id = state.env.canister_id();
        state.with_caller_user_mut(|my_index, user| {
            user_core::updates::approve_transfer::prepare(user, &mut args, now)
                .map(|now_nanos| (UserId::new_indexed(canister_id, my_index), now_nanos))
        })
    })?;

    user_core::updates::approve_transfer::approve(args, my_user_id, now_nanos).await
}
