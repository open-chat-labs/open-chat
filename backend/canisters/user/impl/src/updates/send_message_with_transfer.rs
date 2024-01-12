use crate::guards::caller_is_owner;
use crate::model::p2p_trades::{P2PTradeOffer, P2PTradeOfferStatus};
use crate::timer_job_types::{NotifyEscrowCanisterOfDepositJob, SendMessageToChannelJob, SendMessageToGroupJob, TimerJob};
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::MessageContentInternal;
use escrow_canister::deposit_subaccount;
use ic_cdk_macros::update;
use icrc_ledger_types::icrc1::account::Account;
use types::{
    icrc1, CanisterId, Chat, CompletedCryptoTransaction, CryptoTransaction, MessageContentInitial, PendingCryptoTransaction,
    TimestampMillis, UserId, MAX_TEXT_LENGTH, MAX_TEXT_LENGTH_USIZE,
};
use user_canister::send_message_with_transfer_to_channel;
use user_canister::send_message_with_transfer_to_group;
use utils::consts::{MEMO_MESSAGE, MEMO_P2P_OFFER, MEMO_PRIZE};
use utils::time::{NANOS_PER_MILLISECOND, SECOND_IN_MS};

#[update(guard = "caller_is_owner")]
#[trace]
async fn send_message_with_transfer_to_channel(
    args: send_message_with_transfer_to_channel::Args,
) -> send_message_with_transfer_to_channel::Response {
    use send_message_with_transfer_to_channel::Response::*;

    run_regular_jobs();

    // Check that the user is a member of the community
    let (exists, now) = read_state(|state| (state.data.communities.exists(&args.community_id), state.env.now()));
    if !exists {
        return UserNotInCommunity(None);
    }

    // Validate the content and extract the PendingCryptoTransaction
    let (pending_transaction, p2p_offer_id) =
        match mutate_state(|state| prepare(Chat::Channel(args.community_id, args.channel_id), &args.content, now, state)) {
            PrepareResult::Success(t) => (t, None),
            PrepareResult::P2PTrade(escrow_canister_id, args) => match set_up_p2p_trade(escrow_canister_id, args).await {
                Ok((id, t)) => (t, Some(id)),
                Err(error) => return error.into(),
            },
            PrepareResult::UserSuspended => return UserSuspended,
            PrepareResult::TextTooLong(v) => return TextTooLong(v),
            PrepareResult::RecipientBlocked => return RecipientBlocked,
            PrepareResult::InvalidRequest(t) => return InvalidRequest(t),
            PrepareResult::TransferCannotBeZero => return TransferCannotBeZero,
            PrepareResult::TransferCannotBeToSelf => return TransferCannotBeToSelf,
        };

    // Make the crypto transfer
    let (content, completed_transaction) = match process_transaction(args.content, pending_transaction, p2p_offer_id, now).await
    {
        Ok((c, t)) => (c, t),
        Err(error) => return TransferFailed(error),
    };

    // Build the send_message args
    let c2c_args = community_canister::c2c_send_message::Args {
        channel_id: args.channel_id,
        message_id: args.message_id,
        thread_root_message_index: args.thread_root_message_index,
        content,
        sender_name: args.sender_name,
        sender_display_name: args.sender_display_name,
        replies_to: args.replies_to,
        mentioned: args.mentioned,
        forwarding: false,
        community_rules_accepted: args.community_rules_accepted,
        channel_rules_accepted: args.channel_rules_accepted,
        message_filter_failed: args.message_filter_failed,
    };

    // Send the message to the community
    use community_canister::c2c_send_message::Response;
    match community_canister_c2c_client::c2c_send_message(args.community_id.into(), &c2c_args).await {
        Ok(response) => match response {
            Response::Success(r) => {
                if let Some(id) = p2p_offer_id {
                    update_p2p_trade_status(id, P2PTradeOfferStatus::Open);
                }
                Success(send_message_with_transfer_to_channel::SuccessResult {
                    event_index: r.event_index,
                    message_index: r.message_index,
                    timestamp: r.timestamp,
                    expires_at: r.expires_at,
                    transfer: completed_transaction,
                })
            }
            Response::UserNotInCommunity => UserNotInCommunity(Some(completed_transaction)),
            Response::UserNotInChannel => UserNotInChannel(completed_transaction),
            Response::ChannelNotFound => ChannelNotFound(completed_transaction),
            Response::UserSuspended => UserSuspended,
            Response::CommunityFrozen => CommunityFrozen,
            Response::RulesNotAccepted => RulesNotAccepted,
            Response::CommunityRulesNotAccepted => CommunityRulesNotAccepted,
            Response::MessageEmpty
            | Response::InvalidPoll(_)
            | Response::NotAuthorized
            | Response::ThreadMessageNotFound
            | Response::InvalidRequest(_)
            | Response::TextTooLong(_) => unreachable!(),
        },
        Err(error) => {
            mutate_state(|state| {
                let now = state.env.now();
                state.data.timer_jobs.enqueue_job(
                    TimerJob::SendMessageToChannel(Box::new(SendMessageToChannelJob {
                        community_id: args.community_id,
                        args: c2c_args,
                        p2p_offer_id,
                        attempt: 0,
                    })),
                    now + 10 * SECOND_IN_MS,
                    now,
                );
            });
            Retrying(format!("{error:?}"), completed_transaction)
        }
    }
}

#[update(guard = "caller_is_owner")]
#[trace]
async fn send_message_with_transfer_to_group(
    args: send_message_with_transfer_to_group::Args,
) -> send_message_with_transfer_to_group::Response {
    use send_message_with_transfer_to_group::Response::*;

    run_regular_jobs();

    // Check that the user is a member of the group
    let (exists, now) = read_state(|state| (state.data.group_chats.exists(&args.group_id), state.env.now()));
    if !exists {
        return CallerNotInGroup(None);
    }

    // Validate the content and extract the PendingCryptoTransaction
    let (pending_transaction, p2p_offer_id) =
        match mutate_state(|state| prepare(Chat::Group(args.group_id), &args.content, now, state)) {
            PrepareResult::Success(t) => (t, None),
            PrepareResult::P2PTrade(escrow_canister_id, args) => match set_up_p2p_trade(escrow_canister_id, args).await {
                Ok((id, t)) => (t, Some(id)),
                Err(error) => return error.into(),
            },
            PrepareResult::UserSuspended => return UserSuspended,
            PrepareResult::TextTooLong(v) => return TextTooLong(v),
            PrepareResult::RecipientBlocked => return RecipientBlocked,
            PrepareResult::InvalidRequest(t) => return InvalidRequest(t),
            PrepareResult::TransferCannotBeZero => return TransferCannotBeZero,
            PrepareResult::TransferCannotBeToSelf => return TransferCannotBeToSelf,
        };

    // Make the crypto transfer
    let (content, completed_transaction) = match process_transaction(args.content, pending_transaction, p2p_offer_id, now).await
    {
        Ok((c, t)) => (c, t),
        Err(error) => return TransferFailed(error),
    };

    // Build the send_message args
    let c2c_args = group_canister::c2c_send_message::Args {
        message_id: args.message_id,
        thread_root_message_index: args.thread_root_message_index,
        content,
        sender_name: args.sender_name,
        sender_display_name: args.sender_display_name,
        replies_to: args.replies_to,
        mentioned: args.mentioned,
        forwarding: false,
        rules_accepted: args.rules_accepted,
        message_filter_failed: args.message_filter_failed,
        correlation_id: args.correlation_id,
    };

    // Send the message to the group
    use group_canister::c2c_send_message::Response;
    match group_canister_c2c_client::c2c_send_message(args.group_id.into(), &c2c_args).await {
        Ok(response) => match response {
            Response::Success(r) => {
                if let Some(id) = p2p_offer_id {
                    update_p2p_trade_status(id, P2PTradeOfferStatus::Open);
                }
                Success(send_message_with_transfer_to_group::SuccessResult {
                    event_index: r.event_index,
                    message_index: r.message_index,
                    timestamp: r.timestamp,
                    expires_at: r.expires_at,
                    transfer: completed_transaction,
                })
            }
            Response::CallerNotInGroup => CallerNotInGroup(Some(completed_transaction)),
            Response::UserSuspended => UserSuspended,
            Response::ChatFrozen => ChatFrozen,
            Response::RulesNotAccepted => RulesNotAccepted,
            Response::MessageEmpty
            | Response::InvalidPoll(_)
            | Response::NotAuthorized
            | Response::ThreadMessageNotFound
            | Response::InvalidRequest(_)
            | Response::TextTooLong(_) => unreachable!(),
        },
        Err(error) => {
            mutate_state(|state| {
                let now = state.env.now();
                state.data.timer_jobs.enqueue_job(
                    TimerJob::SendMessageToGroup(Box::new(SendMessageToGroupJob {
                        chat_id: args.group_id,
                        args: c2c_args,
                        p2p_offer_id,
                        attempt: 0,
                    })),
                    now + 10 * SECOND_IN_MS,
                    now,
                );
            });
            Retrying(format!("{error:?}"), completed_transaction)
        }
    }
}

enum PrepareResult {
    Success(PendingCryptoTransaction),
    P2PTrade(CanisterId, escrow_canister::create_offer::Args),
    UserSuspended,
    TextTooLong(u32),
    RecipientBlocked,
    InvalidRequest(String),
    TransferCannotBeZero,
    TransferCannotBeToSelf,
}

fn prepare(chat: Chat, content: &MessageContentInitial, now: TimestampMillis, state: &mut RuntimeState) -> PrepareResult {
    use PrepareResult::*;

    if state.data.suspended.value {
        return UserSuspended;
    } else if content.text_length() > MAX_TEXT_LENGTH_USIZE {
        return TextTooLong(MAX_TEXT_LENGTH);
    }

    let pending_transaction = match &content {
        MessageContentInitial::Crypto(c) => {
            let my_user_id = state.env.canister_id().into();
            if c.recipient == my_user_id {
                return TransferCannotBeToSelf;
            }
            if state.data.blocked_users.contains(&c.recipient) {
                return RecipientBlocked;
            }
            match &c.transfer {
                CryptoTransaction::Pending(t) => t.clone().set_memo(&MEMO_MESSAGE),
                _ => return InvalidRequest("Transaction must be of type 'Pending'".to_string()),
            }
        }
        MessageContentInitial::Prize(c) => {
            if c.end_date <= now {
                return InvalidRequest("Prize end date must be in the future".to_string());
            }
            match &c.transfer {
                CryptoTransaction::Pending(t) => {
                    let total_prize = c.prizes.iter().map(|t| t.e8s()).sum::<u64>() as u128;
                    let prize_fees = c.prizes.len() as u128 * t.fee();
                    let total_amount_to_send = total_prize + prize_fees;

                    if t.units() != total_amount_to_send {
                        return InvalidRequest("Transaction amount must equal total prize + prize fees".to_string());
                    }

                    t.clone().set_memo(&MEMO_PRIZE)
                }
                _ => return InvalidRequest("Transaction must be of type 'Pending'".to_string()),
            }
        }
        MessageContentInitial::P2PTrade(p) => {
            let create_offer_args = escrow_canister::create_offer::Args {
                input_token: p.input_token.clone(),
                input_amount: p.input_amount,
                output_token: p.output_token.clone(),
                output_amount: p.output_amount,
                expires_at: now + p.expires_in,
                canister_to_notify: Some(chat.canister_id()),
            };
            return P2PTrade(state.data.escrow_canister_id, create_offer_args);
        }
        _ => return InvalidRequest("Message must include a crypto transfer".to_string()),
    };

    if !pending_transaction.is_zero() {
        Success(pending_transaction)
    } else {
        TransferCannotBeZero
    }
}

async fn process_transaction(
    content: MessageContentInitial,
    pending_transaction: PendingCryptoTransaction,
    p2p_offer_id: Option<u32>,
    now: TimestampMillis,
) -> Result<(MessageContentInternal, CompletedCryptoTransaction), String> {
    match crate::crypto::process_transaction(pending_transaction).await {
        Ok(completed) => {
            if let Some(id) = p2p_offer_id {
                mutate_state(|state| {
                    let now = state.env.now();
                    state
                        .data
                        .p2p_trades
                        .set_offer_status(id, P2PTradeOfferStatus::FundsTransferred, now);
                });
                NotifyEscrowCanisterOfDepositJob::run(id);
            }
            Ok((
                MessageContentInternal::new_with_transfer(content, completed.clone(), p2p_offer_id, now),
                completed,
            ))
        }
        Err(failed) => {
            if let Some(id) = p2p_offer_id {
                update_p2p_trade_status(id, P2PTradeOfferStatus::TransferError(failed.error_message().to_string()));
            }
            Err(failed.error_message().to_string())
        }
    }
}

async fn set_up_p2p_trade(
    escrow_canister_id: CanisterId,
    args: escrow_canister::create_offer::Args,
) -> Result<(u32, PendingCryptoTransaction), SetUpP2PTradeError> {
    use SetUpP2PTradeError::*;

    let id = match escrow_canister_c2c_client::create_offer(escrow_canister_id, &args).await {
        Ok(escrow_canister::create_offer::Response::Success(result)) => result.id,
        Ok(escrow_canister::create_offer::Response::InvalidOffer(message)) => return Err(InvalidOffer(message)),
        Err(error) => return Err(InternalError(format!("{error:?}"))),
    };

    mutate_state(|state| {
        let my_user_id = UserId::from(state.env.canister_id());
        let now = state.env.now();

        state.data.p2p_trades.add(P2PTradeOffer::new(
            id,
            my_user_id,
            args.input_token.clone(),
            args.input_amount,
            args.output_token.clone(),
            args.output_amount,
            args.expires_at,
            now,
        ));

        let pending_transfer = PendingCryptoTransaction::ICRC1(icrc1::PendingCryptoTransaction {
            ledger: args.input_token.ledger,
            token: args.input_token.token.clone(),
            amount: args.input_amount + args.input_token.fee,
            to: Account {
                owner: state.data.escrow_canister_id,
                subaccount: Some(deposit_subaccount(my_user_id, id)),
            },
            fee: args.input_token.fee,
            memo: Some(MEMO_P2P_OFFER.to_vec().into()),
            created: now * NANOS_PER_MILLISECOND,
        });

        Ok((id, pending_transfer))
    })
}

pub(crate) fn update_p2p_trade_status(id: u32, status: P2PTradeOfferStatus) {
    mutate_state(|state| state.data.p2p_trades.set_offer_status(id, status, state.env.now()));
}

enum SetUpP2PTradeError {
    InvalidOffer(String),
    InternalError(String),
}

impl From<SetUpP2PTradeError> for send_message_with_transfer_to_channel::Response {
    fn from(value: SetUpP2PTradeError) -> Self {
        use send_message_with_transfer_to_channel::Response::*;
        match value {
            SetUpP2PTradeError::InvalidOffer(message) => InvalidRequest(message),
            SetUpP2PTradeError::InternalError(error) => P2PTradeSetUpFailed(error),
        }
    }
}

impl From<SetUpP2PTradeError> for send_message_with_transfer_to_group::Response {
    fn from(value: SetUpP2PTradeError) -> Self {
        use send_message_with_transfer_to_group::Response::*;
        match value {
            SetUpP2PTradeError::InvalidOffer(message) => InvalidRequest(message),
            SetUpP2PTradeError::InternalError(error) => P2PTradeSetUpFailed(error),
        }
    }
}
