use crate::{
    model::{
        pending_payments_queue::{PendingPayment, PendingPaymentReason},
        translations::ApproveResponse,
    },
    mutate_state, read_state,
};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use translations_canister::approve::{Response::*, *};
use types::Cryptocurrency;
use user_index_canister_c2c_client::{lookup_user, LookupUserError};

#[update]
#[trace]
async fn approve(args: Args) -> Response {
    let (user_index_canister_id, caller, now) =
        read_state(|state| (state.data.user_index_canister_id, state.env.caller(), state.env.now()));

    let user_id = match lookup_user(caller, user_index_canister_id).await {
        Ok(user) if user.is_platform_operator => user.user_id,
        Ok(_) | Err(LookupUserError::UserNotFound) => return NotAuthorized,
        Err(LookupUserError::InternalError(error)) => return InternalError(error),
    };

    mutate_state(|state| match state.data.translations.approve(args.id, user_id, now) {
        ApproveResponse::Success(result) => {
            if !result.previously_approved {
                state.data.pending_payments_queue.push(PendingPayment {
                    recipient_account: result.proposed_by.into(),
                    timestamp: now,
                    currency: Cryptocurrency::CHAT,
                    amount: 100_000_000, // 1 CHAT
                    reason: PendingPaymentReason::Approval,
                });
            }
            Success
        }
        ApproveResponse::NotProposed => NotProposed,
        ApproveResponse::NotFound => NotFound,
    })
}
