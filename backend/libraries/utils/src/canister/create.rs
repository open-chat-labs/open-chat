use crate::canister::{
    CanisterToInstall, ChunkedInstallGuard, VersionedWasmToInstall, canister_status, convert_cdk_error, deposit_cycles,
    install, install_basic_raw, set_freezing_threshold,
};
use candid::Principal;
use ic_cdk_management_canister::{self as management_canister, CanisterInstallMode, CanisterSettings, CreateCanisterArgs};
use serde::Serialize;
use tracing::error;
use types::{BuildVersion, C2CError, CanisterId, CanisterWasm, Cycles};

// The IC's default, of 30 days
const DEFAULT_FREEZING_THRESHOLD_SECS: u64 = 30 * 24 * 60 * 60;

// An existing canister (eg. one from a pool) is topped up to `cycles_to_use` and given the IC's
// default freezing threshold before the code is installed, since it may hold few cycles and may have
// had its freezing threshold set to 0 when its cycles were refunded. Its status is read first, which
// also fails for a canister this canister doesn't control, before any cycles are sent to it.
pub async fn create_and_install(
    existing_canister_id: Option<CanisterId>,
    additional_controller: Option<Principal>,
    wasm: VersionedWasmToInstall,
    init_args: Vec<u8>,
    cycles_to_use: Cycles,
    // The canister is topped up if it doesn't have the cycles to install the code, so long as that
    // leaves this canister's own balance above this
    min_cycles_balance: Cycles,
    on_cycles_spent: fn(Cycles) -> (),
) -> Result<CanisterId, (Option<CanisterId>, C2CError)> {
    // Counted from before the canister is created, since the chunks to install were chosen already
    let _guard = ChunkedInstallGuard::new_if_chunked(&wasm.wasm);

    let canister_id = match existing_canister_id {
        Some(id) => {
            let status = canister_status(id).await.map_err(|error| (Some(id), error))?;
            let top_up = cycles_to_use.saturating_sub(status.cycles());
            if top_up > 0 {
                deposit_cycles(id, top_up).await.map_err(|error| (Some(id), error))?;
                on_cycles_spent(top_up);
            }
            if status.settings.freezing_threshold != DEFAULT_FREEZING_THRESHOLD_SECS {
                set_freezing_threshold(id, DEFAULT_FREEZING_THRESHOLD_SECS)
                    .await
                    .map_err(|error| (Some(id), error))?;
            }
            id
        }
        None => match create(cycles_to_use, additional_controller).await {
            Err(error) => {
                return Err((None, error));
            }
            Ok(id) => {
                on_cycles_spent(cycles_to_use);
                id
            }
        },
    };

    match install(CanisterToInstall {
        canister_id,
        current_wasm_version: BuildVersion::default(),
        new_wasm_version: wasm.version,
        new_wasm: wasm.wasm,
        top_up_keeping_balance_above: Some(min_cycles_balance),
        args: init_args,
        mode: CanisterInstallMode::Reinstall,
        stop_start_canister: false,
    })
    .await
    {
        Ok(_) => Ok(canister_id),
        Err(error) => Err((Some(canister_id), error)),
    }
}

pub async fn create_and_install_msgpack<A: Serialize>(
    existing_canister_id: Option<CanisterId>,
    additional_controller: Option<Principal>,
    wasm: CanisterWasm,
    init_args: A,
    cycles_to_use: Cycles,
    on_canister_created: fn(Cycles) -> (),
) -> Result<CanisterId, (Option<CanisterId>, C2CError)> {
    let canister_id = match existing_canister_id {
        Some(id) => id,
        None => match create(cycles_to_use, additional_controller).await {
            Err(error) => {
                return Err((None, error));
            }
            Ok(id) => {
                on_canister_created(cycles_to_use);
                id
            }
        },
    };

    match install_basic_raw(canister_id, wasm, msgpack::serialize_then_unwrap(&init_args)).await {
        Ok(_) => Ok(canister_id),
        Err(error) => Err((Some(canister_id), error)),
    }
}

pub async fn create(cycles_to_use: Cycles, additional_controller: Option<Principal>) -> Result<Principal, C2CError> {
    let mut controllers = vec![ic_cdk::api::canister_self()];
    if let Some(controller) = additional_controller {
        controllers.push(controller);
    }
    match management_canister::create_canister_with_extra_cycles(
        &CreateCanisterArgs {
            settings: Some(CanisterSettings {
                controllers: Some(controllers),
                ..Default::default()
            }),
        },
        cycles_to_use.saturating_sub(ic_cdk::api::cost_create_canister()),
    )
    .await
    {
        Ok(x) => Ok(x.canister_id),
        Err(e) => {
            let error = convert_cdk_error(CanisterId::management_canister(), "create_canister", e);
            error!(?error, "Error calling create_canister");
            Err(error)
        }
    }
}
