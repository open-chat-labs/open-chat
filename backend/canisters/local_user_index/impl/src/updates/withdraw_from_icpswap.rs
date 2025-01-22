use crate::guards::caller_is_platform_operator;
use crate::read_state;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::withdraw_from_icpswap::{Response::*, *};

#[update(guard = "caller_is_platform_operator", msgpack = true)]
#[trace]
async fn withdraw_from_icpswap(args: Args) -> Response {
    if !read_state(|state| state.data.local_users.contains(&args.user_id)) {
        return UserNotFound;
    }

    match user_canister_c2c_client::c2c_withdraw_from_icpswap(
        args.user_id.into(),
        &user_canister::c2c_withdraw_from_icpswap::Args {
            swap_id: args.swap_id,
            input_token: args.input_token,
            amount: args.amount,
            fee: args.fee,
        },
    )
    .await
    {
        Ok(user_canister::c2c_withdraw_from_icpswap::Response::Success) => Success,
        Ok(user_canister::c2c_withdraw_from_icpswap::Response::SwapNotFound) => SwapNotFound,
        Ok(user_canister::c2c_withdraw_from_icpswap::Response::AmountNotSpecified) => AmountNotSpecified,
        Ok(user_canister::c2c_withdraw_from_icpswap::Response::InternalError(error)) => InternalError(error),
        Err(error) => InternalError(format!("{error:?}")),
    }
}
