use crate::{mutate_state, read_state, RuntimeState};
use candid::Principal;
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use local_user_index_canister_c2c_client::{lookup_user, LookupUserError};
use proposals_bot_canister::c2c_submit_proposal::{Response::*, *};
use proposals_bot_canister::ProposalToSubmitAction;
use sns_governance_canister::types::manage_neuron::Command;
use sns_governance_canister::types::proposal::Action;
use sns_governance_canister::types::{Motion, Proposal, Subaccount, TransferSnsTreasuryFunds};
use types::{CanisterId, SnsNeuronId};

#[update_msgpack]
#[trace]
async fn c2c_submit_proposal(args: Args) -> Response {
    let PrepareResult {
        caller,
        local_user_index_canister_id,
        neuron_id,
    } = match read_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    match lookup_user(caller, local_user_index_canister_id).await {
        Ok(_) => {}
        Err(LookupUserError::UserNotFound) => unreachable!(),
        Err(LookupUserError::InternalError(error)) => return InternalError(error),
    }

    let make_proposal_args = sns_governance_canister::manage_neuron::Args {
        subaccount: neuron_id.to_vec(),
        command: Some(Command::MakeProposal(Proposal {
            title: args.proposal.title,
            summary: args.proposal.summary,
            url: args.proposal.url,
            action: Some(convert_proposal_action(args.proposal.action)),
        })),
    };
    if let Err(error) =
        sns_governance_canister_c2c_client::manage_neuron(args.governance_canister_id, &make_proposal_args).await
    {
        mutate_state(|state| {
            state.data.fire_and_forget_handler.send(
                args.governance_canister_id,
                "manage_neuron".to_string(),
                candid::encode_one(&make_proposal_args).unwrap(),
            )
        });
        Retrying(format!("{error:?}"))
    } else {
        Success
    }
}

struct PrepareResult {
    caller: Principal,
    local_user_index_canister_id: CanisterId,
    neuron_id: SnsNeuronId,
}

fn prepare(args: &Args, state: &RuntimeState) -> Result<PrepareResult, Response> {
    if let Some(neuron_id) = state
        .data
        .nervous_systems
        .get_neuron_id_for_submitting_proposals(&args.governance_canister_id)
    {
        Ok(PrepareResult {
            caller: state.env.caller(),
            local_user_index_canister_id: state.data.local_user_index_canister_id,
            neuron_id,
        })
    } else {
        Err(GovernanceCanisterNotSupported)
    }
}

fn convert_proposal_action(action: ProposalToSubmitAction) -> Action {
    match action {
        ProposalToSubmitAction::Motion => Action::Motion(Motion {
            motion_text: "".to_string(),
        }),
        ProposalToSubmitAction::TransferSnsTreasuryFunds(t) => Action::TransferSnsTreasuryFunds(TransferSnsTreasuryFunds {
            from_treasury: if t.icp { 1 } else { 2 },
            amount_e8s: t.amount.try_into().unwrap(),
            memo: t.memo,
            to_principal: Some(t.destination.owner),
            to_subaccount: t.destination.subaccount.map(|sa| Subaccount { subaccount: sa.to_vec() }),
        }),
    }
}
