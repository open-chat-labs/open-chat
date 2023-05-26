use crate::{mutate_state, RuntimeState};
use ic_cdk_macros::heartbeat;
use storage_bucket_canister::c2c_sync_index::{Args, Response, SuccessResult};
use tracing::error;
use types::{CanisterId, CanisterWasm, Cycles, Version};

const MAX_CONCURRENT_CANISTER_UPGRADES: usize = 1;
const MIN_CYCLES_BALANCE: Cycles = 60_000_000_000_000; // 60T
const BUCKET_CANISTER_INITIAL_CYCLES_BALANCE: Cycles = 25_000_000_000_000; // 25T;

#[heartbeat]
fn heartbeat() {
    ensure_sufficient_active_buckets::run();
    sync_buckets::run();
    upgrade_canisters::run();
}

mod ensure_sufficient_active_buckets {
    use super::*;
    use crate::model::buckets::BucketRecord;
    use utils::canister::create_and_install;
    use utils::consts::CREATE_CANISTER_CYCLES_FEE;
    use PrepareResponse::*;

    pub fn run() {
        match mutate_state(prepare) {
            DoNothing => (),
            CyclesBalanceTooLow => error!("Cycles balance too low to add a new bucket"),
            CreateBucket(args) => {
                ic_cdk::spawn(create_bucket(args));
            }
        }
    }

    struct CreateBucketArgs {
        canister_wasm: CanisterWasm,
        cycles_to_use: Cycles,
        init_canister_args: storage_bucket_canister::init::Args,
    }

    enum PrepareResponse {
        DoNothing,
        CyclesBalanceTooLow,
        CreateBucket(CreateBucketArgs),
    }

    fn prepare(state: &mut RuntimeState) -> PrepareResponse {
        if !state.data.buckets.try_to_acquire_creation_lock() {
            return DoNothing;
        }

        let cycles_required = BUCKET_CANISTER_INITIAL_CYCLES_BALANCE + CREATE_CANISTER_CYCLES_FEE;

        if !utils::cycles::can_spend_cycles(cycles_required, MIN_CYCLES_BALANCE) {
            state.data.buckets.release_creation_lock();
            return CyclesBalanceTooLow;
        }

        CreateBucket(CreateBucketArgs {
            canister_wasm: state.data.bucket_canister_wasm.clone(),
            cycles_to_use: cycles_required,
            init_canister_args: storage_bucket_canister::init::Args {
                wasm_version: state.data.bucket_canister_wasm.version,
                test_mode: state.data.test_mode,
            },
        })
    }

    async fn create_bucket(args: CreateBucketArgs) {
        let wasm_version = args.canister_wasm.version;

        let result = create_and_install(
            None,
            args.canister_wasm,
            args.init_canister_args,
            args.cycles_to_use,
            on_bucket_created,
        )
        .await;

        if let Ok(canister_id) = result {
            let bucket = BucketRecord::new(canister_id, wasm_version);
            mutate_state(|state| state.data.add_bucket(bucket, true))
        } else {
            mutate_state(|state| state.data.buckets.release_creation_lock());
        }
    }

    fn on_bucket_created(cycles: Cycles) {
        mutate_state(|state| state.data.total_cycles_spent_on_canisters += cycles);
    }
}

mod sync_buckets {
    use super::*;

    pub fn run() {
        for (canister_id, args) in mutate_state(next_batch) {
            ic_cdk::spawn(send_to_bucket(canister_id, args));
        }
    }

    fn next_batch(state: &mut RuntimeState) -> Vec<(CanisterId, Args)> {
        state.data.buckets.pop_args_for_next_sync()
    }

    async fn send_to_bucket(canister_id: CanisterId, args: Args) {
        match storage_bucket_canister_c2c_client::c2c_sync_index(canister_id, &args).await {
            Ok(Response::Success(result)) => {
                mutate_state(|state| handle_success(canister_id, result, state));
            }
            Err(_) => {
                mutate_state(|state| handle_error(canister_id, args, state));
            }
        }
    }

    fn handle_success(canister_id: CanisterId, result: SuccessResult, state: &mut RuntimeState) {
        for file in result.files_removed {
            state.data.remove_file_reference(canister_id, file);
        }

        if let Some(bucket) = state.data.buckets.get_mut(&canister_id) {
            bucket.sync_state.mark_sync_completed();
        }
    }

    fn handle_error(canister_id: CanisterId, args: Args, state: &mut RuntimeState) {
        if let Some(bucket) = state.data.buckets.get_mut(&canister_id) {
            bucket.sync_state.mark_sync_failed(args);
        }
    }
}

mod upgrade_canisters {
    use super::*;
    use ic_cdk::api::management_canister::main::CanisterInstallMode;
    use utils::canister::FailedUpgrade;

    type CanisterToUpgrade = utils::canister::CanisterToInstall<storage_bucket_canister::post_upgrade::Args>;

    pub fn run() {
        let canisters_to_upgrade = mutate_state(next_batch);
        if !canisters_to_upgrade.is_empty() {
            ic_cdk::spawn(perform_upgrades(canisters_to_upgrade));
        }
    }

    fn next_batch(state: &mut RuntimeState) -> Vec<CanisterToUpgrade> {
        let count_in_progress = state.data.canisters_requiring_upgrade.count_in_progress();
        (0..(MAX_CONCURRENT_CANISTER_UPGRADES - count_in_progress))
            .map_while(|_| try_get_next(state))
            .collect()
    }

    fn try_get_next(state: &mut RuntimeState) -> Option<CanisterToUpgrade> {
        let canister_id = state.data.canisters_requiring_upgrade.try_take_next()?;
        let bucket = state.data.buckets.get(&canister_id)?;
        let new_wasm = state.data.bucket_canister_wasm.clone();
        let wasm_version = new_wasm.version;

        Some(CanisterToUpgrade {
            canister_id,
            current_wasm_version: bucket.wasm_version,
            new_wasm,
            args: storage_bucket_canister::post_upgrade::Args { wasm_version },
            deposit_cycles_if_needed: false,
            mode: CanisterInstallMode::Upgrade,
            stop_start_canister: true,
        })
    }

    async fn perform_upgrades(canisters_to_upgrade: Vec<CanisterToUpgrade>) {
        let futures: Vec<_> = canisters_to_upgrade.into_iter().map(perform_upgrade).collect();

        futures::future::join_all(futures).await;
    }

    async fn perform_upgrade(canister_to_upgrade: CanisterToUpgrade) {
        let canister_id = canister_to_upgrade.canister_id;
        let from_version = canister_to_upgrade.current_wasm_version;
        let to_version = canister_to_upgrade.new_wasm.version;

        match utils::canister::install(canister_to_upgrade).await {
            Ok(_) => {
                mutate_state(|state| on_success(canister_id, to_version, state));
            }
            Err(_) => {
                mutate_state(|state| on_failure(canister_id, from_version, to_version, state));
            }
        }
    }

    fn on_success(canister_id: CanisterId, to_version: Version, state: &mut RuntimeState) {
        if let Some(bucket) = state.data.buckets.get_mut(&canister_id) {
            bucket.wasm_version = to_version;
        }
        state.data.canisters_requiring_upgrade.mark_success(&canister_id);
    }

    fn on_failure(canister_id: CanisterId, from_version: Version, to_version: Version, state: &mut RuntimeState) {
        state.data.canisters_requiring_upgrade.mark_failure(FailedUpgrade {
            canister_id,
            from_version,
            to_version,
        });
    }
}
