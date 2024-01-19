use crate::guards::caller_is_governance_principal;
use crate::read_state;
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use identity_canister::update_user_principal::{Response::*, *};

#[update(guard = "caller_is_governance_principal")]
#[trace]
async fn appoint_admins(args: Args) -> Response {
    let user_index_canister_id = read_state(|state| state.data.user_index_canister_id);

    match user_index_canister_c2c_client::c2c_update_user_principal(
        user_index_canister_id,
        &user_index_canister::c2c_update_user_principal::Args {
            old_principal: args.old_principal,
            new_principal: args.new_principal,
        },
    )
    .await
    {
        Ok(user_index_canister::c2c_update_user_principal::Response::Success) => Success,
        Ok(user_index_canister::c2c_update_user_principal::Response::InternalError(error)) => InternalError(error),
        Err(error) => InternalError(format!("{error:?}")),
    }
}
