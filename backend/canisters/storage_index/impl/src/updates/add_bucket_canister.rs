use crate::guards::caller_is_governance_principal;
use crate::model::buckets::BucketRecord;
use crate::read_state;
use crate::{RuntimeState, mutate_state};
use candid::Principal;
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use constants::NANOS_PER_MILLISECOND;
use cycles_minting_canister::notify_create_canister::{Subnet, SubnetSelection};
use ic_cdk::call::RejectCode;
use ic_ledger_types::{AccountIdentifier, DEFAULT_FEE, Memo, Subaccount, Timestamp, Tokens, TransferArgs};
use storage_index_canister::add_bucket_canister::{Response::*, *};
use types::{C2CError, CanisterId, CanisterWasm, TimestampMillis};
use utils::canister::install_basic;

const MEMO_CREATE_CANISTER: Memo = Memo(0x41455243); // == 'CREA'

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
async fn add_bucket_canister(args: Args) -> Response {
    let PrepareResult {
        this_canister_id,
        ledger,
        cmc,
        wasm,
        init_args,
        now,
    } = read_state(prepare);

    let canister_id = match create_canister(ledger, cmc, args.subnet_id, this_canister_id, now).await {
        Ok(id) => id,
        Err(error) => return Error(error.into()),
    };

    let wasm_version = wasm.version;
    if let Err(error) = install_basic(canister_id, wasm, init_args).await {
        return Error(error.into());
    }

    let bucket = BucketRecord::new(canister_id, wasm_version);
    mutate_state(|state| state.data.add_bucket(bucket));
    Success
}

struct PrepareResult {
    this_canister_id: CanisterId,
    ledger: CanisterId,
    cmc: CanisterId,
    wasm: CanisterWasm,
    init_args: storage_bucket_canister::init::Args,
    now: TimestampMillis,
}

fn prepare(state: &RuntimeState) -> PrepareResult {
    PrepareResult {
        this_canister_id: state.env.canister_id(),
        ledger: state.data.icp_ledger_canister_id,
        cmc: state.data.cycles_minting_canister_id,
        wasm: state.data.bucket_canister_wasm.clone(),
        init_args: storage_bucket_canister::init::Args {
            wasm_version: state.data.bucket_canister_wasm.version,
            test_mode: state.data.test_mode,
        },
        now: state.env.now(),
    }
}

// Attempts to create a canister by sending 1 ICP to the CMC
async fn create_canister(
    ledger: CanisterId,
    cmc: CanisterId,
    subnet: Principal,
    this_canister_id: Principal,
    now: TimestampMillis,
) -> Result<CanisterId, C2CError> {
    let block_index = icp_ledger_canister_c2c_client::transfer(
        ledger,
        &TransferArgs {
            memo: MEMO_CREATE_CANISTER,
            amount: Tokens::from_e8s(100_000_000), // 1 ICP
            fee: DEFAULT_FEE,
            from_subaccount: None,
            to: AccountIdentifier::new(&cmc, &Subaccount::from(this_canister_id)),
            created_at_time: Some(Timestamp {
                timestamp_nanos: now * NANOS_PER_MILLISECOND,
            }),
        },
    )
    .await?
    .map_err(|e| C2CError::new(ledger, "transfer", RejectCode::CanisterError, format!("{e:?}")))?;

    cycles_minting_canister_c2c_client::notify_create_canister(
        cmc,
        &cycles_minting_canister::notify_create_canister::Args {
            block_index,
            controller: this_canister_id,
            subnet_selection: Some(SubnetSelection::Subnet(Subnet { subnet })),
        },
    )
    .await?
    .map_err(|e| C2CError::new(cmc, "notify_create_canister", RejectCode::CanisterError, format!("{e:?}")))
}
