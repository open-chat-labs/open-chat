use crate::activity_notifications::handle_activity_notification;
use crate::{CommunityEventPusher, RuntimeState, execute_update_async, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::claim_prize::{Response::*, *};
use constants::MEMO_PRIZE_CLAIM;
use ledger_utils::{create_pending_transaction, process_transaction};
use oc_error_codes::OCErrorCode;
use rand::Rng;
use tracing::error;
use types::{CanisterId, CompletedCryptoTransaction, DiamondMembershipStatus, OCResult, PendingCryptoTransaction, UserId};

#[update(msgpack = true)]
#[trace]
async fn claim_prize(args: Args) -> Response {
    execute_update_async(|| claim_prize_impl(args)).await
}

async fn claim_prize_impl(args: Args) -> Response {
    // Validate the request and reserve a prize
    let prepare_result = match mutate_state(|state| prepare(&args, state)) {
        Ok(c) => c,
        Err(error) => return Error(error),
    };

    let prize_amount = prepare_result.transaction.units();

    // Transfer the prize to the winner
    let result = process_transaction(prepare_result.transaction, prepare_result.this_canister_id, true).await;

    match result {
        Ok(Ok(completed_transaction)) => {
            // Claim the prize and send a message to the community
            if let Some(error_message) =
                mutate_state(|state| commit(args, prepare_result.user_id, completed_transaction.clone(), state))
            {
                FailedAfterTransfer(error_message, completed_transaction)
            } else {
                Success
            }
        }
        Ok(Err(failed_transaction)) => {
            error!(?failed_transaction, "Prize claim failed with ledger error");
            // Rollback the prize reservation
            let error_message = mutate_state(|state| rollback(args, prepare_result.user_id, prize_amount, true, state));
            TransferFailed(error_message, failed_transaction)
        }
        Err(error) => {
            mutate_state(|state| rollback(args, prepare_result.user_id, prize_amount, false, state));
            Error(error.into())
        }
    }
}

struct PrepareResult {
    pub transaction: PendingCryptoTransaction,
    pub this_canister_id: CanisterId,
    pub user_id: UserId,
}

fn prepare(args: &Args, state: &mut RuntimeState) -> OCResult<PrepareResult> {
    state.data.verify_not_frozen()?;

    let member = state.get_calling_member(true)?;
    let channel = state.data.channels.get_mut_or_err(&args.channel_id)?;
    let now = state.env.now();
    let now_nanos = state.env.now_nanos();
    let user_id = member.user_id;
    let result = channel.chat.reserve_prize(
        user_id,
        args.message_id,
        now,
        true,
        DiamondMembershipStatus::Lifetime,
        1000000,
        10000,
        u64::MAX,
    )?;

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
        this_canister_id: state.env.canister_id(),
        transaction,
        user_id,
    })
}

fn commit(args: Args, winner: UserId, transaction: CompletedCryptoTransaction, state: &mut RuntimeState) -> Option<String> {
    let now = state.env.now();

    let channel = match state.data.channels.get_mut(&args.channel_id) {
        Some(c) => c,
        None => return Some("ChannelNotFound".to_string()),
    };

    match channel.chat.events.claim_prize(
        args.message_id,
        winner,
        transaction,
        state.env.rng().r#gen(),
        CommunityEventPusher {
            now,
            rng: state.env.rng(),
            queue: &mut state.data.local_user_index_event_sync_queue,
        },
        now,
    ) {
        Ok(result) => {
            state.push_bot_notification(result.bot_notification);
            handle_activity_notification(state);
            None
        }
        Err(e) if e.matches_code(OCErrorCode::MessageNotFound) => Some("MessageNotFound".to_string()),
        Err(e) if e.matches_code(OCErrorCode::NoChange) => Some("ReservationNotFound".to_string()),
        Err(e) => Some(format!("ReservationError: {e:?}")),
    }
}

fn rollback(args: Args, user_id: UserId, amount: u128, ledger_error: bool, state: &mut RuntimeState) -> String {
    let channel = match state.data.channels.get_mut(&args.channel_id) {
        Some(c) => c,
        None => return "ChannelNotFound".to_string(),
    };

    let now = state.env.now();
    match channel
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
