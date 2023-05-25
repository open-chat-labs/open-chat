use crate::read_state;
use canister_tracing_macros::trace;
use group_index_canister::set_community_upgrade_concurrency::{Response::*, *};
use ic_cdk_macros::update;
use tracing::info;
use types::CanisterId;
use user_index_canister_c2c_client::{lookup_user, LookupUserError};

#[update]
#[trace]
async fn set_community_upgrade_concurrency(args: Args) -> Response {
    let (caller, user_index_canister_id, local_group_index_canisters) = read_state(|state| {
        (
            state.env.caller(),
            state.data.user_index_canister_id,
            state.data.local_index_map.canisters().copied().collect::<Vec<CanisterId>>(),
        )
    });

    match lookup_user(caller, user_index_canister_id).await {
        Ok(user) if user.is_platform_operator => (),
        Ok(_) | Err(LookupUserError::UserNotFound) => return NotAuthorized,
        Err(LookupUserError::InternalError(error)) => return InternalError(error),
    };

    let args = local_group_index_canister::c2c_set_community_upgrade_concurrency::Args { value: args.value };

    let futures: Vec<_> = local_group_index_canisters
        .into_iter()
        .map(|canister_id| local_group_index_canister_c2c_client::c2c_set_community_upgrade_concurrency(canister_id, &args))
        .collect();

    let result = futures::future::join_all(futures).await;

    if let Some(first_error) = result.into_iter().filter_map(|res| res.err()).next() {
        InternalError(format!("{first_error:?}"))
    } else {
        info!(args.value, "Community upgrade concurrency set");
        Success
    }
}
