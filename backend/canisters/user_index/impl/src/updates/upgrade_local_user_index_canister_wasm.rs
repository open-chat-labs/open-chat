use crate::guards::caller_is_governance_principal;
use crate::{Data, RuntimeState, mutate_state};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use tracing::{error, info};
use types::{BuildVersion, CanisterWasm, UpgradeChunkedCanisterWasmResponse::*};
use user_index_canister::ChildCanisterType;
use user_index_canister::upgrade_local_user_index_canister_wasm::*;
use utils::canister::should_perform_upgrade;

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
fn upgrade_local_user_index_canister_wasm(args: Args) -> Response {
    let response = mutate_state(|state| upgrade_local_user_index_canister_wasm_impl(args, state));
    if !matches!(response, Success) {
        error!(?response, "Failed to upgrade LocalUserIndex canister wasm");
    }
    response
}

fn upgrade_local_user_index_canister_wasm_impl(args: Args, state: &mut RuntimeState) -> Response {
    let chunks_hash = state.data.child_canister_wasms.chunks_hash(ChildCanisterType::LocalUserIndex);

    if args.wasm_hash != chunks_hash {
        return HashMismatch(chunks_hash);
    }

    let version = args.version;

    if !state.data.test_mode && Some(version) <= min_canister_version(&state.data) {
        VersionNotHigher
    } else {
        let wasm = state
            .data
            .child_canister_wasms
            .wasm_from_chunks(ChildCanisterType::LocalUserIndex);

        state.data.canisters_requiring_upgrade.clear();
        state
            .data
            .child_canister_wasms
            .set(ChildCanisterType::LocalUserIndex, CanisterWasm { version, module: wasm });

        let filter = args.filter.unwrap_or_default();

        for canister_id in state
            .data
            .local_index_map
            .iter()
            .filter(|(id, index)| should_perform_upgrade(**id, index.wasm_version(), version, &filter, state.data.test_mode))
            .map(|(c, _)| *c)
        {
            state.data.canisters_requiring_upgrade.enqueue(canister_id, false);
        }
        crate::jobs::upgrade_canisters::start_job_if_required(state);

        state.data.canisters_requiring_upgrade.clear_failed(BuildVersion {
            major: version.major,
            minor: version.minor,
            patch: version.patch.saturating_sub(100),
        });

        let canisters_queued_for_upgrade = state.data.canisters_requiring_upgrade.count_pending();
        info!(%version, canisters_queued_for_upgrade, "Local user index canister wasm upgraded");
        Success
    }
}

fn min_canister_version(data: &Data) -> Option<BuildVersion> {
    data.local_index_map.iter().map(|(_, c)| c.wasm_version()).min()
}
