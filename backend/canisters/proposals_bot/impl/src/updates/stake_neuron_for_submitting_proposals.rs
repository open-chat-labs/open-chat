use crate::{mutate_state, RuntimeState};
use candid::Principal;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use ic_cdk::api::call::{CallResult, RejectionCode};
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::TransferArg;
use ledger_utils::compute_neuron_staking_subaccount_bytes;
use proposals_bot_canister::stake_neuron_for_submitting_proposals::{Response::*, *};
use rand::Rng;
use sns_governance_canister::types::manage_neuron::claim_or_refresh::{By, MemoAndController};
use sns_governance_canister::types::manage_neuron::configure::Operation;
use sns_governance_canister::types::manage_neuron::{ClaimOrRefresh, Command, IncreaseDissolveDelay};
use sns_governance_canister::types::{manage_neuron_response, ManageNeuron};
use sns_governance_canister_c2c_client::configure_neuron;
use types::{CanisterId, SnsNeuronId};
use user_index_canister_c2c_client::LookupUserError;

#[update(msgpack = true)]
#[trace]
async fn stake_neuron_for_submitting_proposals(args: Args) -> Response {
    let PrepareResult {
        caller,
        this_canister_id,
        user_index_canister_id,
        ledger_canister_id,
        nonce,
        dissolve_delay_seconds,
    } = match mutate_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    match user_index_canister_c2c_client::lookup_user(caller, user_index_canister_id).await {
        Ok(user) if user.is_platform_operator => {}
        Err(LookupUserError::InternalError(error)) => return InternalError(error),
        _ => return Unauthorized,
    }

    match stake_neuron_impl(&args, this_canister_id, ledger_canister_id, nonce, dissolve_delay_seconds).await {
        Ok(Success(neuron_id)) => {
            mutate_state(|state| {
                state.data.nervous_systems.set_neuron_id_for_submitting_proposals(
                    &args.governance_canister_id,
                    neuron_id,
                    dissolve_delay_seconds as u64 * 1000,
                );

                state.data.fire_and_forget_handler.send(
                    state.data.registry_canister_id,
                    "c2c_set_submitting_proposals_enabled_msgpack".to_string(),
                    msgpack::serialize_then_unwrap(registry_canister::c2c_set_submitting_proposals_enabled::Args {
                        governance_canister_id: args.governance_canister_id,
                        enabled: true,
                    }),
                );
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
    dissolve_delay_seconds: u32,
}

fn prepare(args: &Args, state: &mut RuntimeState) -> Result<PrepareResult, Response> {
    if let Some(neuron_id) = state
        .data
        .nervous_systems
        .get_neuron_id_for_submitting_proposals(&args.governance_canister_id)
    {
        Err(NeuronAlreadyExists(neuron_id))
    } else if let Some(ns) = state.data.nervous_systems.get(&args.governance_canister_id) {
        if args.stake < u128::from(ns.proposal_rejection_fee()) {
            Err(StakeTooLow)
        } else {
            Ok(PrepareResult {
                caller: state.env.caller(),
                this_canister_id: state.env.canister_id(),
                user_index_canister_id: state.data.user_index_canister_id,
                ledger_canister_id: ns.ledger_canister_id(),
                nonce: state.env.rng().gen(),
                dissolve_delay_seconds: (ns.min_dissolve_delay_to_vote() / 1000) as u32 + 1,
            })
        }
    } else {
        Err(GovernanceCanisterNotSupported)
    }
}

async fn stake_neuron_impl(
    args: &Args,
    this_canister_id: CanisterId,
    ledger_canister_id: CanisterId,
    nonce: u64,
    dissolve_delay_seconds: u32,
) -> CallResult<Response> {
    let subaccount = compute_neuron_staking_subaccount_bytes(this_canister_id, nonce);

    if let Err(transfer_error) = icrc_ledger_canister_c2c_client::icrc1_transfer(
        ledger_canister_id,
        &TransferArg {
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

    configure_neuron(
        args.governance_canister_id,
        neuron_id,
        Operation::IncreaseDissolveDelay(IncreaseDissolveDelay {
            additional_dissolve_delay_seconds: dissolve_delay_seconds,
        }),
    )
    .await?;

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
