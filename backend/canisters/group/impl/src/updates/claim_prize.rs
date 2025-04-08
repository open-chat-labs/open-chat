use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::ReservePrizeResult;
use constants::MEMO_PRIZE_CLAIM;
use group_canister::claim_prize::{Response::*, *};
use ledger_utils::{create_pending_transaction, process_transaction};
use oc_error_codes::OCErrorCode;
use types::{CanisterId, CompletedCryptoTransaction, PendingCryptoTransaction, UserId};

#[update(msgpack = true)]
#[trace]
async fn claim_prize(args: Args) -> Response {
    run_regular_jobs();

    // Validate the request and reserve a prize
    let prepare_result = match mutate_state(|state| prepare(&args, state)) {
        Ok(c) => c,
        Err(response) => return *response,
    };

    let prize_amount = prepare_result.transaction.units();

    // Transfer the prize to the winner
    let result = process_transaction(prepare_result.transaction, prepare_result.group, true).await;

    match result {
        Ok(Ok(completed_transaction)) => {
            // Claim the prize and send a message to the group
            if let Some(error_message) =
                mutate_state(|state| commit(args, prepare_result.user_id, completed_transaction.clone(), state))
            {
                FailedAfterTransfer(error_message, completed_transaction)
            } else {
                Success
            }
        }
        Ok(Err(failed_transaction)) => {
            // Rollback the prize reservation
            let error_message = mutate_state(|state| rollback(args, prepare_result.user_id, prize_amount, true, state));
            TransferFailed(error_message, failed_transaction)
        }
        Err(error) => {
            mutate_state(|state| rollback(args, prepare_result.user_id, prize_amount, false, state));
            InternalError(format!("{error:?}"))
        }
    }
}

struct PrepareResult {
    pub transaction: PendingCryptoTransaction,
    pub group: CanisterId,
    pub user_id: UserId,
}

fn prepare(args: &Args, state: &mut RuntimeState) -> Result<PrepareResult, Box<Response>> {
    if state.data.is_frozen() {
        return Err(Box::new(ChatFrozen));
    }

    let caller = state.env.caller();

    if let Some(member) = state.data.get_member(caller) {
        if member.suspended().value {
            return Err(Box::new(UserSuspended));
        } else if member.lapsed().value {
            return Err(Box::new(UserLapsed));
        }

        let now = state.env.now();
        let now_nanos = state.env.now_nanos();
        let min_visible_event_index = member.min_visible_event_index();
        let user_id = member.user_id();

        let result = match state
            .data
            .chat
            .events
            .reserve_prize(args.message_id, min_visible_event_index, user_id, now)
        {
            ReservePrizeResult::Success(result) => result,
            ReservePrizeResult::AlreadyClaimed => return Err(Box::new(AlreadyClaimed)),
            ReservePrizeResult::MessageNotFound => return Err(Box::new(MessageNotFound)),
            ReservePrizeResult::PrizeFullyClaimed => return Err(Box::new(PrizeFullyClaimed)),
            ReservePrizeResult::PrizeEnded => return Err(Box::new(PrizeEnded)),
            ReservePrizeResult::LedgerError => return Err(Box::new(LedgerError)),
        };

        // Hack to ensure 2 prizes claimed by the same user in the same block don't result in "duplicate transaction" errors.
        let duplicate_buster = u32::from(result.message_index) as u64 % 1000;
        let transaction_time = now_nanos - duplicate_buster;

        let transaction = create_pending_transaction(
            result.token_symbol,
            result.ledger_canister_id,
            result.amount,
            result.fee,
            user_id,
            Some(&MEMO_PRIZE_CLAIM),
            transaction_time,
        );

        Ok(PrepareResult {
            group: state.env.canister_id(),
            transaction,
            user_id,
        })
    } else {
        Err(Box::new(CallerNotInGroup))
    }
}

fn commit(args: Args, winner: UserId, transaction: CompletedCryptoTransaction, state: &mut RuntimeState) -> Option<String> {
    let now = state.env.now();
    match state.data.chat.events.claim_prize(
        args.message_id,
        winner,
        transaction,
        state.env.rng(),
        &mut state.data.event_store_client,
        now,
    ) {
        Ok(_) => {
            handle_activity_notification(state);
            None
        }
        Err(e) if e.matches_code(OCErrorCode::MessageNotFound) => Some("MessageNotFound".to_string()),
        Err(e) if e.matches_code(OCErrorCode::NoChange) => Some("ReservationNotFound".to_string()),
        Err(e) => Some(format!("ReservationError: {e:?}")),
    }
}

fn rollback(args: Args, user_id: UserId, amount: u128, ledger_error: bool, state: &mut RuntimeState) -> String {
    let now = state.env.now();
    match state
        .data
        .chat
        .events
        .unreserve_prize(args.message_id, user_id, amount, ledger_error, now)
    {
        Ok(_) => "prize reservation cancelled".to_string(),
        Err(e) if e.matches_code(OCErrorCode::MessageNotFound) => "prize message not found".to_string(),
        Err(e) if e.matches_code(OCErrorCode::NoChange) => "prize reservation not found".to_string(),
        Err(e) => format!("prize reservation error: {e:?}"),
    }
}
