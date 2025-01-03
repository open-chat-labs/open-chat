use crate::model::nervous_systems::ValidateSubmitProposalPaymentError;
use crate::timer_job_types::ProcessUserRefundJob;
use crate::updates::c2c_submit_proposal::{prepare_proposal, submit_proposal};
use crate::{read_state, RuntimeState};
use candid::Principal;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use ledger_utils::icrc2::process_transaction;
use proposals_bot_canister::submit_proposal::{Response::*, *};
use types::{icrc2, CanisterId, MultiUserChat, SnsNeuronId, UserDetails};
use user_index_canister_c2c_client::{lookup_user, LookupUserError};

#[update(msgpack = true)]
#[trace]
async fn submit_proposal(args: Args) -> Response {
    let PrepareResult {
        caller,
        this_canister_id,
        user_index_canister_id,
        neuron_id,
        chat,
    } = match read_state(|state| prepare(args.governance_canister_id, &args.transaction, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let UserDetails { user_id, username, .. } = match lookup_user(caller, user_index_canister_id).await {
        Ok(u) => u,
        Err(LookupUserError::UserNotFound) => panic!("User not found"),
        Err(LookupUserError::InternalError(error)) => return InternalError(format!("Failed to lookup user: {error}")),
    };

    let refund_if_fails = ProcessUserRefundJob {
        user_id,
        ledger_canister_id: args.transaction.ledger,
        amount: args.transaction.amount,
        fee: args.transaction.fee,
    };

    match process_transaction(args.transaction, this_canister_id).await {
        Ok(Ok(_)) => {}
        Ok(Err(error)) => return PaymentFailed(error.error_message),
        Err(error) => return InternalError(format!("{:?}", error)),
    }

    let proposal = prepare_proposal(args.proposal, user_id, username, chat);

    submit_proposal(user_id, args.governance_canister_id, neuron_id, proposal, refund_if_fails)
        .await
        .into()
}

struct PrepareResult {
    caller: Principal,
    this_canister_id: CanisterId,
    user_index_canister_id: CanisterId,
    neuron_id: SnsNeuronId,
    chat: MultiUserChat,
}

fn prepare(
    governance_canister_id: CanisterId,
    transaction: &icrc2::PendingCryptoTransaction,
    state: &RuntimeState,
) -> Result<PrepareResult, Response> {
    use ValidateSubmitProposalPaymentError as E;
    match state.data.nervous_systems.validate_submit_proposal_payment(
        &governance_canister_id,
        transaction.ledger,
        transaction.amount,
    ) {
        Ok(neuron_id) => Ok(PrepareResult {
            caller: state.env.caller(),
            this_canister_id: state.env.canister_id(),
            user_index_canister_id: state.data.user_index_canister_id,
            neuron_id,
            chat: state.data.nervous_systems.get_chat_id(&governance_canister_id).unwrap(),
        }),
        Err(E::GovernanceCanisterNotSupported | E::IncorrectLedger) => Err(GovernanceCanisterNotSupported),
        Err(E::InsufficientPayment(min)) => Err(InsufficientPayment(min.into())),
    }
}
