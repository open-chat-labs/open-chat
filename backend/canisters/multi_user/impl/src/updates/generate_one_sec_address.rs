use crate::guards::caller_is_hosted_user;
use crate::{mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::{Timestamped, UserIdAndPrincipal};
use user_canister::generate_one_sec_address::{Response::*, *};

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
async fn generate_one_sec_address(_args: Args) -> Response {
    let (my_index, me, cached) = read_state(|state| {
        state.with_caller_user(|my_index, user| {
            (
                my_index,
                UserIdAndPrincipal::new(state.user_id(my_index), user.principal),
                user.one_sec_address.as_ref().map(|a| a.value.clone()),
            )
        })
    });
    if let Some(address) = cached {
        return Success(address);
    }

    match user_core::updates::generate_one_sec_address::fetch_one_sec_address(me).await {
        Ok(address) => {
            mutate_state(|state| {
                let now = state.env.now();
                // Nothing to cache if the user was deleted meanwhile
                state.data.users.with_user_mut(my_index, |user| {
                    user.one_sec_address = Some(Timestamped::new(address.clone(), now))
                });
            });
            Success(address)
        }
        Err(error) => Error(error),
    }
}
