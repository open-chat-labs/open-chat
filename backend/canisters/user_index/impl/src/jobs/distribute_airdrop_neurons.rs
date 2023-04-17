use crate::model::initial_airdrop_queue::InitialAirdropEntry;
use crate::{mutate_state, RuntimeState};
use candid::Principal;
use ic_cdk::api::call::{CallResult, RejectionCode};
use ic_cdk_timers::TimerId;
use ic_sns_governance::pb::v1::manage_neuron::{AddNeuronPermissions, Command, RemoveNeuronPermissions, Split};
use ic_sns_governance::pb::v1::manage_neuron_response::Command as CommandResponse;
use ic_sns_governance::pb::v1::{ManageNeuron, NeuronPermissionList};
use rand_core::RngCore;
use std::cell::Cell;
use std::time::Duration;
use tracing::{error, trace};
use types::{CanisterId, SnsNeuronId, UserId};

const ALL_PERMISSIONS: [i32; 11] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(runtime_state: &RuntimeState) -> bool {
    if TIMER_ID.with(|t| t.get().is_none()) && !runtime_state.data.initial_airdrop_queue.is_empty() {
        let timer_id = ic_cdk_timers::set_timer_interval(Duration::from_secs(2), run);
        TIMER_ID.with(|t| t.set(Some(timer_id)));
        trace!("'distribute_airdrop_neurons' job started");
        true
    } else {
        false
    }
}

pub fn run() {
    match mutate_state(try_get_next) {
        GetNextResult::Success(args) => {
            ic_cdk::spawn(process_next(args));
        }
        GetNextResult::Continue => {}
        GetNextResult::QueueEmpty => {
            if let Some(timer_id) = TIMER_ID.with(|t| t.take()) {
                ic_cdk_timers::clear_timer(timer_id);
                trace!("'distribute_airdrop_neurons' job stopped");
            }
        }
    }
}

enum GetNextResult {
    Success(AirdropNeuronArgs),
    Continue,
    QueueEmpty,
}

fn try_get_next(state: &mut RuntimeState) -> GetNextResult {
    if !state.data.initial_airdrop_queue.can_start_next() {
        GetNextResult::Continue
    } else if let Some(next) = state.data.initial_airdrop_queue.take_next() {
        GetNextResult::Success(AirdropNeuronArgs {
            user_id: next.user_id,
            neuron_controller: next.neuron_controller,
            neuron_stake_e8s: next.neuron_stake_e8s,
            memo: state.env.rng().next_u64(),
            this_canister_id: state.env.canister_id(),
            governance_canister_id: state.data.openchat_governance_canister_id,
            source_neuron_id: state.data.initial_airdrop_neuron_id.unwrap(),
        })
    } else {
        GetNextResult::QueueEmpty
    }
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
    if let Err(error) = airdrop_neuron_to_user(args).await {
        error!(?error, args = ?entry, "Failed to distribute airdrop neuron");
        mutate_state(|state| state.data.initial_airdrop_queue.mark_failed(entry));
    }
}

async fn airdrop_neuron_to_user(args: AirdropNeuronArgs) -> CallResult<SnsNeuronId> {
    let split_result = split(
        args.governance_canister_id,
        args.source_neuron_id,
        args.neuron_stake_e8s,
        args.memo,
    )
    .await;

    // We can start the next one once the split is complete because from that point on the actions
    // act on a new neuron
    mutate_state(|state| state.data.initial_airdrop_queue.mark_split_complete());

    let neuron_id = split_result?;

    add_all_permissions(args.governance_canister_id, neuron_id, args.neuron_controller).await?;
    remove_all_permissions(args.governance_canister_id, neuron_id, args.this_canister_id).await?;

    Ok(neuron_id)
}

async fn split(
    governance_canister_id: CanisterId,
    source_neuron_id: SnsNeuronId,
    stake_e8s: u64,
    memo: u64,
) -> CallResult<[u8; 32]> {
    let args = ManageNeuron {
        subaccount: source_neuron_id.to_vec(),
        command: Some(Command::Split(Split {
            amount_e8s: stake_e8s,
            memo,
        })),
    };

    let response = sns_governance_canister_c2c_client::manage_neuron(governance_canister_id, &args).await?;

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

    let response = sns_governance_canister_c2c_client::manage_neuron(governance_canister_id, &args).await?;

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

    let response = sns_governance_canister_c2c_client::manage_neuron(governance_canister_id, &args).await?;

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
    memo: u64,
    this_canister_id: CanisterId,
    governance_canister_id: CanisterId,
    source_neuron_id: SnsNeuronId,
}
