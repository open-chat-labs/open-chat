use crate::guards::caller_is_governance_principal;
use crate::{mutate_state, read_state, RuntimeState};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use group_index_canister::upgrade_community_canister_wasm::*;
use group_index_canister::ChildCanisterType;
use ic_cdk::api::call::{CallResult, RejectionCode};
use tracing::info;
use types::{CanisterId, CanisterWasm, Hash, UpgradeChunkedCanisterWasmResponse::*, UpgradesFilter};
use utils::canister::build_filter_map;

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
async fn upgrade_community_canister_wasm(args: Args) -> Response {
    let PrepareResult {
        wasm,
        wasm_hash,
        local_group_index_canisters,
    } = match read_state(|state| prepare(args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let version = wasm.version;

    let futures: Vec<_> = local_group_index_canisters
        .into_iter()
        .map(|(canister_id, filter)| process_local_group_index(canister_id, &wasm, wasm_hash, Some(filter)))
        .collect();

    let result = futures::future::join_all(futures).await;

    if let Some(first_error) = result.into_iter().filter_map(|res| res.err()).next() {
        InternalError(format!("{first_error:?}"))
    } else {
        mutate_state(|state| {
            state.data.child_canister_wasms.set(ChildCanisterType::Community, wasm);
        });

        info!(%version, "Community canister wasm upgraded");
        Success
    }
}

struct PrepareResult {
    wasm: CanisterWasm,
    wasm_hash: Hash,
    local_group_index_canisters: Vec<(CanisterId, UpgradesFilter)>,
}

fn prepare(args: Args, state: &RuntimeState) -> Result<PrepareResult, Response> {
    let chunks_hash = state.data.child_canister_wasms.chunks_hash(ChildCanisterType::Community);
    if chunks_hash != args.wasm_hash {
        return Err(HashMismatch(chunks_hash));
    }

    let wasm = state.data.child_canister_wasms.wasm_from_chunks(ChildCanisterType::Community);

    let local_group_index_canister_ids: Vec<_> = state.data.local_index_map.canisters().copied().collect();

    let local_group_index_canisters = build_filter_map(local_group_index_canister_ids, args.filter.unwrap_or_default(), |c| {
        state.data.local_index_map.get_index_canister_for_community(&c.into())
    });

    Ok(PrepareResult {
        wasm: CanisterWasm {
            version: args.version,
            module: wasm,
        },
        wasm_hash: args.wasm_hash,
        local_group_index_canisters,
    })
}

async fn process_local_group_index(
    canister_id: CanisterId,
    canister_wasm: &CanisterWasm,
    wasm_hash: Hash,
    filter: Option<UpgradesFilter>,
) -> CallResult<()> {
    let push_wasm_response = local_group_index_canister_c2c_client::push_wasm_in_chunks(
        canister_id,
        local_group_index_canister::ChildCanisterType::Community,
        &canister_wasm.module,
    )
    .await?;

    if !matches!(
        push_wasm_response,
        local_group_index_canister::c2c_push_wasm_chunk::Response::Success
    ) {
        return Err((RejectionCode::Unknown, format!("{push_wasm_response:?}")));
    }

    local_group_index_canister_c2c_client::c2c_upgrade_community_canister_wasm(
        canister_id,
        &local_group_index_canister::c2c_upgrade_community_canister_wasm::Args {
            version: canister_wasm.version,
            wasm_hash,
            filter,
        },
    )
    .await?;

    Ok(())
}
