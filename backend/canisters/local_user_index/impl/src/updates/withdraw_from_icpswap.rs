use crate::guards::caller_is_platform_operator;
use crate::read_state;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::withdraw_from_icpswap::*;
use oc_error_codes::OCErrorCode;

#[update(guard = "caller_is_platform_operator", msgpack = true)]
#[trace]
async fn withdraw_from_icpswap(args: Args) -> Response {
    if !read_state(|state| state.data.local_users.contains(&args.user_id)) {
        return Response::Error(OCErrorCode::TargetUserNotFound.into());
    }

    user_canister_c2c_client::c2c_withdraw_from_icpswap(
        args.user_id.into(),
        &user_canister::c2c_withdraw_from_icpswap::Args {
            swap_id: args.swap_id,
            input_token: args.input_token,
            amount: args.amount,
            fee: args.fee,
        },
    )
    .await
    .unwrap_or_else(|e| Response::Error(e.into()))
}
