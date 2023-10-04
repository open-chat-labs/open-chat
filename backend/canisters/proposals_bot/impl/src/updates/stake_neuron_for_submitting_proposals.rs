use crate::{mutate_state, RuntimeState};
use candid::Principal;
use canister_tracing_macros::trace;
use ic_cdk::api::call::{CallResult, RejectionCode};
use ic_cdk_macros::update;
use proposals_bot_canister::stake_neuron_for_submitting_proposals::{Response::*, *};
use rand::Rng;
use sha2::{Digest, Sha256};
use sns_governance_canister::types::manage_neuron::claim_or_refresh::{By, MemoAndController};
use sns_governance_canister::types::manage_neuron::configure::Operation;
use sns_governance_canister::types::manage_neuron::{ClaimOrRefresh, Command, Configure, IncreaseDissolveDelay};
use sns_governance_canister::types::{manage_neuron_response, ManageNeuron};
use types::icrc1::Account;
use types::{icrc1, CanisterId, SnsNeuronId};
use user_index_canister_c2c_client::LookupUserError;
use utils::consts::{SNS_GOVERNANCE_CANISTER_ID, SNS_LEDGER_CANISTER_ID};

#[update]
#[trace]
async fn stake_neuron_for_submitting_proposals(args: Args) -> Response {
    let PrepareResult {
        caller,
        this_canister_id,
        user_index_canister_id,
        ledger_canister_id,
        nonce,
    } = match mutate_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    match user_index_canister_c2c_client::lookup_user(caller, user_index_canister_id).await {
        Ok(user) if user.is_platform_operator => {}
        Err(LookupUserError::InternalError(error)) => return InternalError(error),
        _ => return Unauthorized,
    }

    match stake_neuron_impl(&args, this_canister_id, ledger_canister_id, nonce).await {
        Ok(Success(neuron_id)) => {
            mutate_state(|state| {
                state
                    .data
                    .nervous_systems
                    .set_neuron_id_for_submitting_proposals(&args.governance_canister_id, neuron_id);
            });
            Success(neuron_id)
        }
        Ok(response) => response,
        Err(error) => InternalError(format!("{error:?}")),
    }
}

struct PrepareResult {
    caller: Principal,
    this_canister_id: CanisterId,
    user_index_canister_id: CanisterId,
    ledger_canister_id: CanisterId,
    nonce: u64,
}

fn prepare(args: &Args, state: &mut RuntimeState) -> Result<PrepareResult, Response> {
    if let Some(neuron_id) = state
        .data
        .nervous_systems
        .get_neuron_id_for_submitting_proposals(&args.governance_canister_id)
    {
        Err(NeuronAlreadyExists(neuron_id))
    } else if args.governance_canister_id != SNS_GOVERNANCE_CANISTER_ID {
        Err(GovernanceCanisterNotSupported)
    } else if args.stake < 4_0000_0000 {
        // 4 CHAT
        Err(StakeTooLow)
    } else {
        Ok(PrepareResult {
            caller: state.env.caller(),
            this_canister_id: state.env.canister_id(),
            user_index_canister_id: state.data.user_index_canister_id,
            ledger_canister_id: SNS_LEDGER_CANISTER_ID,
            nonce: state.env.rng().gen(),
        })
    }
}

async fn stake_neuron_impl(
    args: &Args,
    this_canister_id: CanisterId,
    ledger_canister_id: CanisterId,
    nonce: u64,
) -> CallResult<Response> {
    let subaccount = compute_neuron_staking_subaccount_bytes(this_canister_id, nonce);

    if let Err(transfer_error) = icrc1_ledger_canister_c2c_client::icrc1_transfer(
        ledger_canister_id,
        &icrc1::TransferArg {
            from_subaccount: None,
            to: Account {
                owner: args.governance_canister_id,
                subaccount: Some(subaccount),
            },
            fee: None,
            created_at_time: None,
            memo: None,
            amount: args.stake.into(),
        },
    )
    .await?
    {
        return Ok(TransferError(format!("{transfer_error:?}")));
    }

    let neuron_id = claim_neuron(this_canister_id, args.governance_canister_id, nonce).await?;

    increase_dissolve_delay(args.governance_canister_id, neuron_id).await?;

    Ok(Success(neuron_id))
}

async fn claim_neuron(this_canister_id: CanisterId, governance_canister_id: CanisterId, nonce: u64) -> CallResult<SnsNeuronId> {
    let args = ManageNeuron {
        subaccount: vec![],
        command: Some(Command::ClaimOrRefresh(ClaimOrRefresh {
            by: Some(By::MemoAndController(MemoAndController {
                controller: Some(this_canister_id),
                memo: nonce,
            })),
        })),
    };

    let response = sns_governance_canister_c2c_client::manage_neuron(governance_canister_id, &args).await?;

    match response.command.unwrap() {
        manage_neuron_response::Command::ClaimOrRefresh(c) => Ok(c.refreshed_neuron_id.unwrap().id.try_into().unwrap()),
        manage_neuron_response::Command::Error(e) => Err((RejectionCode::Unknown, format!("{e:?}"))),
        _ => unreachable!(),
    }
}

async fn increase_dissolve_delay(governance_canister_id: CanisterId, neuron_id: SnsNeuronId) -> CallResult<()> {
    let args = ManageNeuron {
        subaccount: neuron_id.to_vec(),
        command: Some(Command::Configure(Configure {
            operation: Some(Operation::IncreaseDissolveDelay(IncreaseDissolveDelay {
                additional_dissolve_delay_seconds: 1,
            })),
        })),
    };

    let response = sns_governance_canister_c2c_client::manage_neuron(governance_canister_id, &args).await?;

    match response.command.unwrap() {
        manage_neuron_response::Command::Configure(_) => Ok(()),
        manage_neuron_response::Command::Error(e) => Err((RejectionCode::Unknown, format!("{e:?}"))),
        _ => unreachable!(),
    }
}

fn compute_neuron_staking_subaccount_bytes(controller: Principal, nonce: u64) -> [u8; 32] {
    const DOMAIN: &[u8] = b"neuron-stake";
    const DOMAIN_LENGTH: [u8; 1] = [0x0c];

    let mut hasher = Sha256::new();
    hasher.update(DOMAIN_LENGTH);
    hasher.update(DOMAIN);
    hasher.update(controller.as_slice());
    hasher.update(nonce.to_be_bytes());
    hasher.finalize().into()
}
