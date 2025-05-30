use crate::guards::caller_is_governance_principal;
use crate::{RuntimeState, mutate_state, read_state};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use group_index_canister::ChildCanisterType;
use group_index_canister::upgrade_group_canister_wasm::*;
use ic_cdk::call::RejectCode;
use tracing::{error, info};
use types::{C2CError, CanisterId, CanisterWasm, Hash, UpgradeChunkedCanisterWasmResponse::*, UpgradesFilter};
use utils::canister::build_filter_map;

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
async fn upgrade_group_canister_wasm(args: Args) -> Response {
    let PrepareResult {
        wasm,
        wasm_hash,
        local_index_canisters,
    } = match read_state(|state| prepare(args, state)) {
        Ok(ok) => ok,
        Err(response) => {
            error!(?response, "Failed to upgrade Group canister wasm");
            return response;
        }
    };

    let version = wasm.version;

    let futures: Vec<_> = local_index_canisters
        .into_iter()
        .map(|(canister_id, filter)| upgrade_group_wasm_in_local_index(canister_id, &wasm, wasm_hash, Some(filter)))
        .collect();

    if let Err(error) = futures::future::try_join_all(futures).await {
        error!(?error, "Failed to upgrade Group canisters");
        InternalError(format!("{error:?}"))
    } else {
        mutate_state(|state| {
            state.data.child_canister_wasms.set(ChildCanisterType::Group, wasm);
        });

        info!(%version, "Group canister wasm upgraded");
        Success
    }
}

struct PrepareResult {
    wasm: CanisterWasm,
    wasm_hash: Hash,
    local_index_canisters: Vec<(CanisterId, UpgradesFilter)>,
}

fn prepare(args: Args, state: &RuntimeState) -> Result<PrepareResult, Response> {
    let chunks_hash = state.data.child_canister_wasms.chunks_hash(ChildCanisterType::Group);
    if chunks_hash != args.wasm_hash {
        return Err(HashMismatch(chunks_hash));
    }

    let wasm = state.data.child_canister_wasms.wasm_from_chunks(ChildCanisterType::Group);

    let local_index_canister_ids: Vec<_> = state.data.local_index_map.canisters().copied().collect();

    let local_index_canisters = build_filter_map(local_index_canister_ids, args.filter.unwrap_or_default(), |c| {
        state.data.local_index_map.get_index_canister_for_group(&c.into())
    });

    Ok(PrepareResult {
        wasm: CanisterWasm {
            version: args.version,
            module: wasm,
        },
        wasm_hash: args.wasm_hash,
        local_index_canisters,
    })
}

pub(crate) async fn upgrade_group_wasm_in_local_index(
    canister_id: CanisterId,
    canister_wasm: &CanisterWasm,
    wasm_hash: Hash,
    filter: Option<UpgradesFilter>,
) -> Result<(), C2CError> {
    let push_wasm_response = local_user_index_canister_c2c_client::push_wasm_in_chunks(
        canister_id,
        local_user_index_canister::ChildCanisterType::Group,
        &canister_wasm.module,
    )
    .await?;

    if !matches!(
        push_wasm_response,
        local_user_index_canister::c2c_push_wasm_chunk::Response::Success
    ) {
        return Err(C2CError::new(
            canister_id,
            "c2c_push_wasm_chunk",
            RejectCode::CanisterError,
            format!("{push_wasm_response:?}"),
        ));
    }

    let upgrade_response = local_user_index_canister_c2c_client::c2c_upgrade_group_canister_wasm(
        canister_id,
        &local_user_index_canister::c2c_upgrade_group_canister_wasm::Args {
            version: canister_wasm.version,
            wasm_hash,
            filter,
        },
    )
    .await?;

    if !matches!(upgrade_response, Success) {
        return Err(C2CError::new(
            canister_id,
            "c2c_upgrade_group_canister_wasm",
            RejectCode::CanisterError,
            format!("{upgrade_response:?}"),
        ));
    }

    Ok(())
}
