use crate::timer_job_types::{CancelP2PSwapInEscrowCanisterJob, NotifyEscrowCanisterOfSwapFundedJob};
use crate::updates::send_message::send_message_with_completed_transfer;
use crate::{RuntimeState, execute_update_async, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::{MessageContentInternal, ValidateNewMessageContentResult};
use constants::{MEMO_MESSAGE, MEMO_PRIZE};
use group_canister::send_message_with_transfer::{Response::*, *};
use group_community_common::{MemberTransfer, NewP2PSwap, validate_prize};
use oc_error_codes::OCErrorCode;
use tracing::error;
use types::{
    Caller, CanisterId, Chat, CompletedCryptoTransaction, MessageContentType, OCResult, P2PSwapLocation, TimestampMillis,
    UserId, UserIdAndPrincipal, UserType, icrc2,
};

#[update(msgpack = true)]
#[trace]
async fn send_message_with_transfer(args: Args) -> Response {
    execute_update_async(|| send_message_with_transfer_impl(args)).await
}

async fn send_message_with_transfer_impl(args: Args) -> Response {
    let (user_id, prepared) = match mutate_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(error) => return Error(error),
    };

    let (transfer, p2p_swap_id) = match prepared {
        // The transfer was certified, so the message has been sent already
        PrepareResult::Sent(result) => return Success(result),
        PrepareResult::Icrc2(transfer) => match ledger_utils::icrc2::process_transaction_for_user(transfer, user_id).await {
            Ok(Ok(completed)) => (completed.into(), None),
            Ok(Err((_, error))) => return Error(error),
            Err(error) => return Error(error.into()),
        },
        PrepareResult::P2PSwap(swap) => {
            let offered_by = swap.swap.offered_by();
            match swap
                .swap
                .create(swap.escrow_canister_id, swap.local_user_index_canister_id, swap.now)
                .await
            {
                Ok((swap_id, completed)) => {
                    NotifyEscrowCanisterOfSwapFundedJob::run(swap_id, offered_by);
                    (completed, Some(swap_id))
                }
                Err((error, swap_id)) => {
                    if let Some(swap_id) = swap_id {
                        // Whether the swap was funded may not be known, so the Escrow canister is
                        // notified too, which refunds any deposit once the swap is cancelled
                        CancelP2PSwapInEscrowCanisterJob::run(swap_id);
                        NotifyEscrowCanisterOfSwapFundedJob::run(swap_id, offered_by);
                    }
                    return Error(error);
                }
            }
        }
    };

    match mutate_state(|state| send(user_id, &args, transfer, p2p_swap_id, state)) {
        Ok(result) => Success(result),
        Err(error) => {
            error!(?error, "Failed to send message after making its transfer");
            if let Some(swap_id) = p2p_swap_id {
                CancelP2PSwapInEscrowCanisterJob::run(swap_id);
            }
            Error(error)
        }
    }
}

enum PrepareResult {
    Sent(SuccessResult),
    Icrc2(icrc2::PendingCryptoTransaction),
    P2PSwap(Box<P2PSwapToCreate>),
}

struct P2PSwapToCreate {
    swap: NewP2PSwap,
    escrow_canister_id: CanisterId,
    local_user_index_canister_id: CanisterId,
    now: TimestampMillis,
}

fn prepare(args: &Args, state: &mut RuntimeState) -> OCResult<(UserId, PrepareResult)> {
    state.data.verify_not_frozen()?;

    if state.data.chat.external_url.is_some() {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    let Caller::User(user_id) = state.verified_caller(None)? else {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    };

    let now = state.env.now();
    let this_canister_id = state.env.canister_id();

    let (content_type, memo, transfer, recipient) =
        match MessageContentInternal::validate_new_message(args.content.clone(), false, UserType::User, false, now) {
            ValidateNewMessageContentResult::SuccessCrypto(c) => {
                if c.recipient == user_id {
                    return Err(OCErrorCode::TransferCannotBeToSelf.into());
                }
                let recipient = state.member_wallet(c.recipient)?;
                (MessageContentType::Crypto, MEMO_MESSAGE.as_slice(), c.transfer, recipient)
            }
            ValidateNewMessageContentResult::SuccessPrize(p) => {
                validate_prize(&p, args.thread_root_message_index)?;
                // The group holds the prize, paying out each winner's share from its own account
                let recipient = UserIdAndPrincipal::new(this_canister_id.into(), this_canister_id);
                (MessageContentType::Prize, MEMO_PRIZE.as_slice(), p.transfer, recipient)
            }
            ValidateNewMessageContentResult::SuccessP2PSwap(p) => {
                state.data.chat.check_can_send_message(
                    user_id,
                    args.thread_root_message_index,
                    args.message_id,
                    MessageContentType::P2PSwap,
                    args.rules_accepted,
                )?;
                let location = P2PSwapLocation::from_message(
                    Chat::Group(this_canister_id.into()),
                    args.thread_root_message_index,
                    args.message_id,
                );
                let swap = NewP2PSwap::new(&p, location, state.member_wallet(user_id)?, this_canister_id, now)?;
                return Ok((
                    user_id,
                    PrepareResult::P2PSwap(Box::new(P2PSwapToCreate {
                        swap,
                        escrow_canister_id: state.data.escrow_canister_id,
                        local_user_index_canister_id: state.data.local_user_index_canister_id,
                        now,
                    })),
                ));
            }
            ValidateNewMessageContentResult::Error(error) => return Err(error.into()),
            ValidateNewMessageContentResult::Success(_) => {
                return Err(OCErrorCode::InvalidRequest.with_message("Message must include a crypto transfer"));
            }
        };

    let transfer = MemberTransfer::new(transfer, recipient, memo, this_canister_id)?;

    state.data.chat.check_can_send_message(
        user_id,
        args.thread_root_message_index,
        args.message_id,
        content_type,
        args.rules_accepted,
    )?;

    match transfer {
        MemberTransfer::Icrc2(transfer) => Ok((user_id, PrepareResult::Icrc2(transfer))),
        MemberTransfer::Certified(transfer) => {
            let completed = state.data.certified_transfers.verify(
                transfer,
                state.env.caller(),
                memo,
                this_canister_id,
                &state.env.ic_root_key(),
                now,
            )?;
            let result = send(user_id, args, completed.clone().into(), None, state)?;
            state.data.certified_transfers.mark_used(&completed, now);
            Ok((user_id, PrepareResult::Sent(result)))
        }
    }
}

fn send(
    user_id: UserId,
    args: &Args,
    transfer: CompletedCryptoTransaction,
    p2p_swap_id: Option<u32>,
    state: &mut RuntimeState,
) -> OCResult<SuccessResult> {
    let now = state.env.now();
    let content = MessageContentInternal::new_with_transfer(args.content.clone(), transfer.clone().into(), p2p_swap_id, now);

    let c2c_args = group_canister::c2c_send_message::Args {
        thread_root_message_index: args.thread_root_message_index,
        message_id: args.message_id,
        content,
        sender_name: args.sender_name.clone(),
        sender_display_name: args.sender_display_name.clone(),
        replies_to: args.replies_to.clone(),
        mentioned: args.mentioned.clone(),
        forwarding: false,
        block_level_markdown: args.block_level_markdown,
        rules_accepted: args.rules_accepted,
        message_filter_failed: args.message_filter_failed,
        og_previews: args.og_previews.clone(),
    };

    let result = send_message_with_completed_transfer(&Caller::User(user_id), c2c_args, args.new_achievement, state)?;

    Ok(SuccessResult {
        event_index: result.event_index,
        message_index: result.message_index,
        timestamp: result.timestamp,
        expires_at: result.expires_at,
        transfer,
    })
}
