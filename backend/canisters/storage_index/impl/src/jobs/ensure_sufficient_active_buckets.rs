use crate::model::buckets::BucketRecord;
use crate::{mutate_state, RuntimeState, MIN_CYCLES_BALANCE};
use std::time::Duration;
use tracing::error;
use types::{CanisterWasm, Cycles};
use utils::canister::create_and_install;
use utils::canister_timers::run_now_then_interval;
use utils::consts::CREATE_CANISTER_CYCLES_FEE;
use utils::time::MINUTE_IN_MS;
use PrepareResponse::*;

const BUCKET_CANISTER_INITIAL_CYCLES_BALANCE: Cycles = 25_000_000_000_000; // 25T;

pub fn start_job() {
    run_now_then_interval(Duration::from_millis(5 * MINUTE_IN_MS), run);
}

fn run() {
    let prepare_response = mutate_state(prepare);
    match prepare_response {
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
