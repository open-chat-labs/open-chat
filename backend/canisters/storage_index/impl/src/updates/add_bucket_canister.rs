use crate::guards::caller_is_governance_principal;
use crate::model::buckets::BucketRecord;
use crate::{BUCKET_CANISTER_TOP_UP_AMOUNT, MIN_CYCLES_BALANCE, RuntimeState, mutate_state, read_state};
use candid::Principal;
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use cycles_minting_canister::create_canister::{Subnet, SubnetSelection};
use ic_cdk::call::RejectCode;
use oc_error_codes::OCErrorCode;
use storage_index_canister::add_bucket_canister::*;
use types::{C2CError, CanisterId, CanisterWasm, Cycles};
use utils::canister::install_basic;
use utils::cycles::can_spend_cycles;

// A new bucket starts with a top-up's worth of cycles, and asks for more as it fills
const BUCKET_CREATION_CYCLES: Cycles = BUCKET_CANISTER_TOP_UP_AMOUNT;

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
async fn add_bucket_canister(args: Args) -> Response {
    let PrepareResult { cmc, wasm, init_args } = match read_state(prepare) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let canister_id = match create_canister(cmc, args.subnet_id, BUCKET_CREATION_CYCLES).await {
        Ok(id) => id,
        Err(error) => return Response::Error(error.into()),
    };
    mutate_state(|state| state.data.total_cycles_spent_on_canisters += BUCKET_CREATION_CYCLES);

    let wasm_version = wasm.version;
    if let Err(error) = install_basic(canister_id, wasm, init_args).await {
        return Response::Error(error.into());
    }

    let bucket = BucketRecord::new(canister_id, wasm_version);
    mutate_state(|state| {
        let now = state.env.now();
        state.data.add_bucket(bucket, now, state.env.rng())
    });
    Response::Success
}

struct PrepareResult {
    cmc: CanisterId,
    wasm: CanisterWasm,
    init_args: storage_bucket_canister::init::Args,
}

fn prepare(state: &RuntimeState) -> Result<PrepareResult, Response> {
    if !can_spend_cycles(BUCKET_CREATION_CYCLES, MIN_CYCLES_BALANCE) {
        return Err(OCErrorCode::CyclesBalanceTooLow.into());
    }
    Ok(PrepareResult {
        cmc: state.data.cycles_minting_canister_id,
        wasm: state.data.bucket_canister_wasm.clone(),
        init_args: storage_bucket_canister::init::Args {
            wasm_version: state.data.bucket_canister_wasm.version,
            test_mode: state.data.test_mode,
        },
    })
}

// Only the CMC can create a canister on another subnet: it is paid with the cycles attached to the
// call, and makes this canister the controller
async fn create_canister(cmc: CanisterId, subnet: Option<Principal>, cycles: Cycles) -> Result<CanisterId, C2CError> {
    cycles_minting_canister_c2c_client::create_canister(
        cmc,
        &cycles_minting_canister::create_canister::Args {
            subnet_selection: subnet.map(|s| SubnetSelection::Subnet(Subnet { subnet: s })),
        },
        cycles,
    )
    .await?
    .map_err(|e| C2CError::new(cmc, "create_canister", RejectCode::CanisterError, format!("{e:?}")))
}
