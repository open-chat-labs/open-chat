use crate::guards::caller_is_governance_principal;
use crate::model::buckets::BucketRecord;
use crate::read_state;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use storage_index_canister::add_bucket_canister::{Response::*, *};
use types::{CanisterId, CanisterWasm, Cycles};
use utils::canister::create_and_install;

// dfx canister --network ic call storage_index add_bucket_canister '(record { canister_id = principal "myzmx-wqaaa-aaaar-ad2ua-cai" })'
#[proposal(guard = "caller_is_governance_principal")]
#[trace]
async fn add_bucket_canister(args: Args) -> Response {
    let InitBucketArgs { wasm, init_args } = match read_state(|state| prepare(args.canister_id, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let wasm_version = wasm.version;

    if let Err(error) = create_and_install(Some(args.canister_id), wasm, init_args, 0, on_bucket_created).await {
        InternalError(format!("{error:?}"))
    } else {
        let bucket = BucketRecord::new(args.canister_id, wasm_version);
        mutate_state(|state| state.data.add_bucket(bucket, false));
        Success
    }
}

struct InitBucketArgs {
    wasm: CanisterWasm,
    init_args: storage_bucket_canister::init::Args,
}

fn prepare(canister_id: CanisterId, runtime_state: &RuntimeState) -> Result<InitBucketArgs, Response> {
    if runtime_state.data.buckets.get(&canister_id).is_some() {
        Err(BucketAlreadyAdded)
    } else {
        Ok(InitBucketArgs {
            wasm: runtime_state.data.bucket_canister_wasm.clone(),
            init_args: storage_bucket_canister::init::Args {
                wasm_version: runtime_state.data.bucket_canister_wasm.version,
                test_mode: runtime_state.data.test_mode,
            },
        })
    }
}

fn on_bucket_created(cycles: Cycles) {
    mutate_state(|state| state.data.total_cycles_spent_on_canisters += cycles);
}
