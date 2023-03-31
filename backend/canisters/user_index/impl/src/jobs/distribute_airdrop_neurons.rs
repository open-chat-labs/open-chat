use crate::model::initial_airdrop_queue::InitialAirdropEntry;
use crate::{mutate_state, RuntimeState};
use candid::Principal;
use canister_client::make_c2c_call;
use ic_cdk::api::call::{CallResult, RejectionCode};
use ic_cdk_timers::TimerId;
use ic_sns_governance::pb::v1::manage_neuron::{AddNeuronPermissions, Command, RemoveNeuronPermissions, Split};
use ic_sns_governance::pb::v1::manage_neuron_response::Command as CommandResponse;
use ic_sns_governance::pb::v1::{ManageNeuron, ManageNeuronResponse, NeuronPermissionList};
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;
use types::{CanisterId, SnsNeuronId, UserId};
use utils::hasher::hash_bytes;

const ALL_PERMISSIONS: [i32; 11] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(runtime_state: &RuntimeState) -> bool {
    if TIMER_ID.with(|t| t.get().is_none()) && !runtime_state.data.initial_airdrop_queue.is_empty() {
        let timer_id = ic_cdk_timers::set_timer_interval(Duration::from_secs(1), run);
        TIMER_ID.with(|t| t.set(Some(timer_id)));
        trace!("'distribute_airdrop_neurons' job started");
        true
    } else {
        false
    }
}

pub fn run() {
    if let Some(args) = mutate_state(try_get_next) {
        ic_cdk::spawn(process_next(args));
    } else if let Some(timer_id) = TIMER_ID.with(|t| t.take()) {
        ic_cdk_timers::clear_timer(timer_id);
        trace!("'distribute_airdrop_neurons' job stopped");
    }
}

fn try_get_next(state: &mut RuntimeState) -> Option<AirdropNeuronArgs> {
    state.data.initial_airdrop_queue.take_next().map(|e| AirdropNeuronArgs {
        user_id: e.user_id,
        neuron_controller: e.neuron_controller,
        neuron_stake_e8s: e.neuron_stake_e8s,
        this_canister_id: state.env.canister_id(),
        governance_canister_id: state.data.openchat_governance_canister_id,
        source_neuron_id: state.data.initial_airdrop_neuron_id.unwrap(),
    })
}

async fn process_next(args: AirdropNeuronArgs) {
    trace!(
        %args.user_id,
        %args.neuron_controller,
        args.neuron_stake_e8s,
        "Distributing airdrop neuron"
    );
    let entry = InitialAirdropEntry {
        user_id: args.user_id,
        neuron_controller: args.neuron_controller,
        neuron_stake_e8s: args.neuron_stake_e8s,
    };
    if airdrop_neuron_to_user(args).await.is_err() {
        mutate_state(|state| state.data.initial_airdrop_queue.mark_failed(entry));
    }
}

async fn airdrop_neuron_to_user(args: AirdropNeuronArgs) -> CallResult<SnsNeuronId> {
    let neuron_id = split(
        args.governance_canister_id,
        args.neuron_controller,
        args.source_neuron_id,
        args.neuron_stake_e8s,
    )
    .await?;

    add_all_permissions(args.governance_canister_id, neuron_id, args.neuron_controller).await?;
    remove_all_permissions(args.governance_canister_id, neuron_id, args.this_canister_id).await?;

    Ok(neuron_id)
}

async fn split(
    governance_canister_id: CanisterId,
    recipient_principal: Principal,
    source_neuron_id: SnsNeuronId,
    stake_e8s: u64,
) -> CallResult<[u8; 32]> {
    let memo = u64::from_be_bytes(hash_bytes(recipient_principal.as_slice())[..8].try_into().unwrap());

    let args = ManageNeuron {
        subaccount: source_neuron_id.to_vec(),
        command: Some(Command::Split(Split {
            amount_e8s: stake_e8s,
            memo,
        })),
    };

    let response: ManageNeuronResponse =
        make_c2c_call(governance_canister_id, "manage_neuron", args, candid::encode_one, |r| {
            candid::decode_one(r)
        })
        .await?;

    match response.command.unwrap() {
        CommandResponse::Split(s) => Ok(s.created_neuron_id.unwrap().id.try_into().unwrap()),
        CommandResponse::Error(e) => Err((RejectionCode::Unknown, format!("{e:?}"))),
        _ => unreachable!(),
    }
}

async fn add_all_permissions(governance_canister_id: CanisterId, neuron_id: [u8; 32], principal: Principal) -> CallResult<()> {
    let args = ManageNeuron {
        subaccount: neuron_id.to_vec(),
        command: Some(Command::AddNeuronPermissions(AddNeuronPermissions {
            principal_id: Some(principal.into()),
            permissions_to_add: Some(NeuronPermissionList {
                permissions: ALL_PERMISSIONS.to_vec(),
            }),
        })),
    };

    let response: ManageNeuronResponse =
        make_c2c_call(governance_canister_id, "manage_neuron", args, candid::encode_one, |r| {
            candid::decode_one(r)
        })
        .await?;

    match response.command.unwrap() {
        CommandResponse::AddNeuronPermission(_) => Ok(()),
        CommandResponse::Error(e) => Err((RejectionCode::Unknown, format!("{e:?}"))),
        _ => unreachable!(),
    }
}

async fn remove_all_permissions(
    governance_canister_id: CanisterId,
    neuron_id: SnsNeuronId,
    principal: Principal,
) -> CallResult<()> {
    let args = ManageNeuron {
        subaccount: neuron_id.to_vec(),
        command: Some(Command::RemoveNeuronPermissions(RemoveNeuronPermissions {
            principal_id: Some(principal.into()),
            permissions_to_remove: Some(NeuronPermissionList {
                permissions: ALL_PERMISSIONS.to_vec(),
            }),
        })),
    };

    let response: ManageNeuronResponse =
        make_c2c_call(governance_canister_id, "manage_neuron", args, candid::encode_one, |r| {
            candid::decode_one(r)
        })
        .await?;

    match response.command.unwrap() {
        CommandResponse::RemoveNeuronPermission(_) => Ok(()),
        CommandResponse::Error(e) => Err((RejectionCode::Unknown, format!("{e:?}"))),
        _ => unreachable!(),
    }
}

struct AirdropNeuronArgs {
    user_id: UserId,
    neuron_controller: Principal,
    neuron_stake_e8s: u64,
    this_canister_id: CanisterId,
    governance_canister_id: CanisterId,
    source_neuron_id: SnsNeuronId,
}
