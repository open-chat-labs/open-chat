use crate::guards::caller_is_hosted_user;
use crate::{execute_update_async, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use multi_user_canister::generate_sol_address::{Response::*, *};
use types::Timestamped;
use user_core::updates::update_sol_balance::sol_deposit_account;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
async fn generate_sol_address(args: Args) -> Response {
    execute_update_async(|| generate_sol_address_impl(args)).await
}

async fn generate_sol_address_impl(_args: Args) -> Response {
    let (my_index, deposit_account, cached) = read_state(|state| {
        state.with_caller_user(|my_index, user| {
            (
                my_index,
                sol_deposit_account(state.env.canister_id(), user.principal),
                user.sol_address.as_ref().map(|a| a.value.clone()),
            )
        })
    });
    if let Some(sol_address) = cached {
        return Success(sol_address);
    }

    match user_core::updates::generate_sol_address::fetch_sol_address(deposit_account).await {
        Ok(sol_address) => {
            mutate_state(|state| {
                let now = state.env.now();
                // Nothing to cache if the user was deleted meanwhile
                state.data.users.with_user_mut(my_index, |user| {
                    user.sol_address = Some(Timestamped::new(sol_address.clone(), now))
                });
            });
            Success(sol_address)
        }
        Err(error) => Error(error.into()),
    }
}
