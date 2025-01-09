use crate::{mutate_state, RuntimeState};
use candid::Principal;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use ic_cdk::api::call::{CallResult, RejectionCode};
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::TransferArg;
use proposals_bot_canister::top_up_neuron::{Response::*, *};
use sns_governance_canister::types::manage_neuron::claim_or_refresh::By;
use sns_governance_canister::types::manage_neuron::{ClaimOrRefresh, Command};
use sns_governance_canister::types::{manage_neuron_response, Empty, ManageNeuron};
use types::{CanisterId, SnsNeuronId};
use user_index_canister_c2c_client::LookupUserError;

#[update(msgpack = true)]
#[trace]
async fn top_up_neuron(args: Args) -> Response {
    let PrepareResult {
        caller,
        user_index_canister_id,
        ledger_canister_id,
        sns_neuron_id,
    } = match mutate_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    match user_index_canister_c2c_client::lookup_user(caller, user_index_canister_id).await {
        Ok(user) if user.is_platform_operator => {}
        Err(LookupUserError::InternalError(error)) => return InternalError(error),
        _ => return Unauthorized,
    }

    top_up_neuron_impl(&args, ledger_canister_id, sns_neuron_id)
        .await
        .unwrap_or_else(|error| InternalError(format!("{error:?}")))
}

struct PrepareResult {
    caller: Principal,
    user_index_canister_id: CanisterId,
    ledger_canister_id: CanisterId,
    sns_neuron_id: SnsNeuronId,
}

fn prepare(args: &Args, state: &mut RuntimeState) -> Result<PrepareResult, Response> {
    if let Some(ns) = state.data.nervous_systems.get(&args.governance_canister_id) {
        if let Some(sns_neuron_id) = ns.neuron_for_submitting_proposals() {
            return Ok(PrepareResult {
                caller: state.env.caller(),
                user_index_canister_id: state.data.user_index_canister_id,
                ledger_canister_id: ns.ledger_canister_id(),
                sns_neuron_id,
            });
        }
    }
    Err(GovernanceCanisterNotSupported)
}

async fn top_up_neuron_impl(args: &Args, ledger_canister_id: CanisterId, sns_neuron_id: SnsNeuronId) -> CallResult<Response> {
    if let Err(transfer_error) = icrc_ledger_canister_c2c_client::icrc1_transfer(
        ledger_canister_id,
        &TransferArg {
            from_subaccount: None,
            to: Account {
                owner: args.governance_canister_id,
                subaccount: Some(sns_neuron_id),
            },
            fee: None,
            created_at_time: None,
            memo: None,
            amount: args.amount.into(),
        },
    )
    .await?
    {
        return Ok(TransferError(format!("{transfer_error:?}")));
    }

    refresh_neuron(args.governance_canister_id, sns_neuron_id).await?;

    Ok(Success)
}

async fn refresh_neuron(governance_canister_id: CanisterId, sns_neuron_id: SnsNeuronId) -> CallResult<()> {
    let args = ManageNeuron {
        subaccount: sns_neuron_id.to_vec(),
        command: Some(Command::ClaimOrRefresh(ClaimOrRefresh {
            by: Some(By::NeuronId(Empty {})),
        })),
    };

    let response = sns_governance_canister_c2c_client::manage_neuron(governance_canister_id, &args).await?;

    match response.command.unwrap() {
        manage_neuron_response::Command::ClaimOrRefresh(_) => Ok(()),
        manage_neuron_response::Command::Error(e) => Err((RejectionCode::Unknown, format!("{e:?}"))),
        _ => unreachable!(),
    }
}
