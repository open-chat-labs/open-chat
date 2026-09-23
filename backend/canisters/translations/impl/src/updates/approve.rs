use crate::{
    model::{
        pending_payments_queue::{PendingPayment, PendingPaymentReason},
        translations::ApproveResponse,
    },
    mutate_state, read_state,
};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::{CHAT_LEDGER_CANISTER_ID, CHAT_TRANSFER_FEE};
use translations_canister::approve::{Response::*, *};
use types::UserIdAndPrincipal;
use user_index_canister_c2c_client::lookup_user;

#[update(candid = true, msgpack = true)]
#[trace]
async fn approve(args: Args) -> Response {
    let (user_index_canister_id, caller, now) =
        read_state(|state| (state.data.user_index_canister_id, state.env.caller(), state.env.now()));

    let user_id = match lookup_user(caller, user_index_canister_id).await {
        Ok(Some(user)) if user.is_platform_operator => user.user_id,
        Ok(_) => return NotAuthorized,
        Err(error) => return InternalError(format!("{error:?}")),
    };

    // The proposer is paid at their wallet, which for a user in a MultiUser canister is their
    // principal's account, so that is looked up. Anyone else's is the account of their user id.
    let proposer = read_state(|state| state.data.translations.proposed_by(args.id));
    let proposer_principal = match proposer {
        Some(proposer) if proposer.is_indexed() => match lookup_user(proposer.as_principal(), user_index_canister_id).await {
            Ok(Some(user)) if user.user_id == proposer => user.principal,
            Ok(_) => return InternalError(format!("Proposer not found: {proposer}")),
            Err(error) => return InternalError(format!("{error:?}")),
        },
        Some(proposer) => proposer.as_principal(),
        None => return NotFound,
    };

    mutate_state(|state| match state.data.translations.approve(args.id, user_id, now) {
        ApproveResponse::Success(result) => {
            if !result.previously_approved {
                state.data.pending_payments_queue.push(PendingPayment {
                    recipient_account: UserIdAndPrincipal::new(result.proposed_by, proposer_principal).into(),
                    timestamp: now,
                    ledger: CHAT_LEDGER_CANISTER_ID,
                    fee: CHAT_TRANSFER_FEE,
                    amount: 100_000_000, // 1 CHAT
                    reason: PendingPaymentReason::Approval,
                });
                crate::jobs::make_pending_payments::start_job_if_required(state);
            }
            Success
        }
        ApproveResponse::NotProposed => NotProposed,
        ApproveResponse::NotFound => NotFound,
    })
}
