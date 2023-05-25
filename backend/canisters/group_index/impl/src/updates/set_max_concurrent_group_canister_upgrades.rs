use crate::guards::caller_is_governance_principal;
use crate::read_state;
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use group_index_canister::set_max_concurrent_group_canister_upgrades::{Response::*, *};
use tracing::info;

// dfx --identity openchat canister --network ic call group_index set_max_concurrent_group_canister_upgrades '(record { value=N:nat32 })'
#[proposal(guard = "caller_is_governance_principal")]
#[trace]
async fn set_max_concurrent_group_canister_upgrades(args: Args) -> Response {
    let canisters: Vec<_> = read_state(|state| state.data.local_index_map.canisters().copied().collect());

    let args = local_group_index_canister::c2c_set_max_concurrent_group_upgrades::Args { value: args.value };

    let futures: Vec<_> = canisters
        .into_iter()
        .map(|canister_id| local_group_index_canister_c2c_client::c2c_set_max_concurrent_group_upgrades(canister_id, &args))
        .collect();

    let result = futures::future::join_all(futures).await;

    if let Some(first_error) = result.into_iter().filter_map(|res| res.err()).next() {
        InternalError(format!("{first_error:?}"))
    } else {
        info!(args.value, "Max concurrent group upgrades set");
        Success
    }
}
