use crate::guards::caller_is_governance_principal;
use crate::model::buckets::BucketRecord;
use crate::read_state;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use storage_index_canister::add_bucket_canister::{Response::*, *};
use types::{CanisterId, CanisterWasm};
use utils::canister::{install_basic, set_controllers};

// dfx canister --network ic call storage_index add_bucket_canister '(record { canister_id = principal "myzmx-wqaaa-aaaar-ad2ua-cai" })'
#[proposal(guard = "caller_is_governance_principal")]
#[trace]
async fn add_bucket_canister(args: Args) -> Response {
    let InitBucketArgs {
        this_canister_id,
        wasm,
        init_args,
    } = match read_state(|state| prepare(args.canister_id, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let wasm_version = wasm.version;

    if let Err(error) = set_controllers(args.canister_id, vec![this_canister_id]).await {
        InternalError(format!("Failed to set controller: {error:?}"))
    } else if let Err(error) = install_basic(args.canister_id, wasm, init_args).await {
        InternalError(format!("Failed to install canister: {error:?}"))
    } else {
        let bucket = BucketRecord::new(args.canister_id, wasm_version);
        mutate_state(|state| state.data.add_bucket(bucket, false));
        Success
    }
}

struct InitBucketArgs {
    this_canister_id: CanisterId,
    wasm: CanisterWasm,
    init_args: storage_bucket_canister::init::Args,
}

fn prepare(canister_id: CanisterId, state: &RuntimeState) -> Result<InitBucketArgs, Response> {
    if state.data.buckets.get(&canister_id).is_some() {
        Err(BucketAlreadyAdded)
    } else {
        Ok(InitBucketArgs {
            this_canister_id: state.env.canister_id(),
            wasm: state.data.bucket_canister_wasm.clone(),
            init_args: storage_bucket_canister::init::Args {
                wasm_version: state.data.bucket_canister_wasm.version,
                test_mode: state.data.test_mode,
            },
        })
    }
}
