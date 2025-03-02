use crate::guards::caller_is_owner;
use crate::model::p2p_swaps::P2PSwap;
use crate::model::pin_number::VerifyPinError;
use crate::timer_job_types::{NotifyEscrowCanisterOfDepositJob, SendMessageToChannelJob, SendMessageToGroupJob, TimerJob};
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::MessageContentInternal;
use constants::{MEMO_MESSAGE, MEMO_P2P_SWAP_CREATE, MEMO_PRIZE, NANOS_PER_MILLISECOND, PRIZE_FEE_PERCENT, SECOND_IN_MS};
use escrow_canister::deposit_subaccount;
use ic_cdk::call::RejectCode;
use tracing::error;
use types::icrc1::Account;
use types::{
    icrc1, Achievement, CanisterId, Chat, CompletedCryptoTransaction, CryptoTransaction, MessageContentInitial, MessageId,
    MessageIndex, Milliseconds, P2PSwapLocation, PendingCryptoTransaction, TimestampMillis, UserId, MAX_TEXT_LENGTH,
    MAX_TEXT_LENGTH_USIZE,
};
use user_canister::send_message_with_transfer_to_group;
use user_canister::{send_message_v2, send_message_with_transfer_to_channel};

#[update(guard = "caller_is_owner", msgpack = true)]
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

    let chat = Chat::Channel(args.community_id, args.channel_id);

    // Validate the content and extract the PendingCryptoTransaction
    let (pending_transaction, p2p_swap_id) = match mutate_state(|state| {
        prepare(
            chat,
            args.thread_root_message_index,
            args.message_id,
            &args.content,
            args.pin.map(|p| p.into()),
            now,
            state,
        )
    }) {
        PrepareResult::Success(t) => (t, None),
        PrepareResult::P2PSwap(escrow_canister_id, create_swap_args) => {
            match set_up_p2p_swap(escrow_canister_id, create_swap_args).await {
                Ok((id, t)) => (t, Some(id)),
                Err(error) => return error.into(),
            }
        }
        PrepareResult::UserSuspended => return UserSuspended,
        PrepareResult::TextTooLong(v) => return TextTooLong(v),
        PrepareResult::RecipientBlocked => return RecipientBlocked,
        PrepareResult::InvalidRequest(t) => return InvalidRequest(t),
        PrepareResult::TransferCannotBeZero => return TransferCannotBeZero,
        PrepareResult::TransferCannotBeToSelf => return TransferCannotBeToSelf,
        PrepareResult::PinRequired => return PinRequired,
        PrepareResult::PinIncorrect(delay) => return PinIncorrect(delay),
        PrepareResult::TooManyFailedPinAttempts(delay) => return TooManyFailedPinAttempts(delay),
    };

    // Make the crypto transfer
    let (content, completed_transaction) = match process_transaction(args.content, pending_transaction, p2p_swap_id, now).await
    {
        Ok(Ok((c, t))) => (c, t),
        Ok(Err(error)) => return TransferFailed(error),
        Err(error) => return InternalError(format!("{error:?}")),
    };

    let achievement = content.content_type().achievement();
    let has_thread = args.thread_root_message_index.is_some();
    let quote_reply = args.replies_to.is_some();

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
        block_level_markdown: args.block_level_markdown,
        community_rules_accepted: args.community_rules_accepted,
        channel_rules_accepted: args.channel_rules_accepted,
        message_filter_failed: args.message_filter_failed,
    };

    // Send the message to the community
    use community_canister::c2c_send_message::Response;
    match community_canister_c2c_client::c2c_send_message(args.community_id.into(), &c2c_args).await {
        Ok(response) => match response {
            Response::Success(r) => {
                mutate_state(|state| award_achievements(achievement, r.message_index, has_thread, quote_reply, state));

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
            Response::UserLapsed => UserLapsed,
            Response::CommunityFrozen => CommunityFrozen,
            Response::RulesNotAccepted => RulesNotAccepted,
            Response::MessageAlreadyExists => MessageAlreadyExists,
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
                        p2p_swap_id,
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

#[update(guard = "caller_is_owner", msgpack = true)]
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

    let chat = Chat::Group(args.group_id);

    // Validate the content and extract the PendingCryptoTransaction
    let (pending_transaction, p2p_swap_id) = match mutate_state(|state| {
        prepare(
            chat,
            args.thread_root_message_index,
            args.message_id,
            &args.content,
            args.pin.map(|p| p.into()),
            now,
            state,
        )
    }) {
        PrepareResult::Success(t) => (t, None),
        PrepareResult::P2PSwap(escrow_canister_id, create_swap_args) => {
            match set_up_p2p_swap(escrow_canister_id, create_swap_args).await {
                Ok((id, t)) => (t, Some(id)),
                Err(error) => return error.into(),
            }
        }
        PrepareResult::UserSuspended => return UserSuspended,
        PrepareResult::TextTooLong(v) => return TextTooLong(v),
        PrepareResult::RecipientBlocked => return RecipientBlocked,
        PrepareResult::InvalidRequest(t) => return InvalidRequest(t),
        PrepareResult::TransferCannotBeZero => return TransferCannotBeZero,
        PrepareResult::TransferCannotBeToSelf => return TransferCannotBeToSelf,
        PrepareResult::PinRequired => return PinRequired,
        PrepareResult::PinIncorrect(delay) => return PinIncorrect(delay),
        PrepareResult::TooManyFailedPinAttempts(delay) => return TooManyFailedPinAttempts(delay),
    };

    // Make the crypto transfer
    let (content, completed_transaction) = match process_transaction(args.content, pending_transaction, p2p_swap_id, now).await
    {
        Ok(Ok((c, t))) => (c, t),
        Ok(Err(error)) => return TransferFailed(error),
        Err(error) => return InternalError(format!("{error:?}")),
    };

    let achievement = content.content_type().achievement();
    let has_thread = args.thread_root_message_index.is_some();
    let quote_reply = args.replies_to.is_some();

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
        block_level_markdown: args.block_level_markdown,
        rules_accepted: args.rules_accepted,
        message_filter_failed: args.message_filter_failed,
        correlation_id: args.correlation_id,
    };

    // Send the message to the group
    use group_canister::c2c_send_message::Response;
    match group_canister_c2c_client::c2c_send_message(args.group_id.into(), &c2c_args).await {
        Ok(response) => match response {
            Response::Success(r) => {
                mutate_state(|state| award_achievements(achievement, r.message_index, has_thread, quote_reply, state));

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
            Response::UserLapsed => UserLapsed,
            Response::ChatFrozen => ChatFrozen,
            Response::RulesNotAccepted => RulesNotAccepted,
            Response::MessageAlreadyExists => MessageAlreadyExists,
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
                        p2p_swap_id,
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
    P2PSwap(CanisterId, escrow_canister::create_swap::Args),
    UserSuspended,
    TextTooLong(u32),
    RecipientBlocked,
    InvalidRequest(String),
    TransferCannotBeZero,
    TransferCannotBeToSelf,
    PinRequired,
    PinIncorrect(Milliseconds),
    TooManyFailedPinAttempts(Milliseconds),
}

fn prepare(
    chat: Chat,
    thread_root_message_index: Option<MessageIndex>,
    message_id: MessageId,
    content: &MessageContentInitial,
    pin: Option<String>,
    now: TimestampMillis,
    state: &mut RuntimeState,
) -> PrepareResult {
    use PrepareResult::*;

    if state.data.suspended.value {
        return UserSuspended;
    } else if content.text_length() > MAX_TEXT_LENGTH_USIZE {
        return TextTooLong(MAX_TEXT_LENGTH);
    }

    if let Err(error) = state.data.pin_number.verify(pin.as_deref(), now) {
        return match error {
            VerifyPinError::PinRequired => PinRequired,
            VerifyPinError::PinIncorrect(delay) => PinIncorrect(delay),
            VerifyPinError::TooManyFailedAttempted(delay) => TooManyFailedPinAttempts(delay),
        };
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
            if thread_root_message_index.is_some() {
                return InvalidRequest("Prize messages cannot be sent within threads".to_string());
            }
            if c.end_date <= now {
                return InvalidRequest("Prize end date must be in the future".to_string());
            }
            match &c.transfer {
                CryptoTransaction::Pending(t) => {
                    let total_prizes = c.prizes_v2.iter().sum::<u128>();
                    let total_transfer_fees = c.prizes_v2.len() as u128 * t.fee();
                    let oc_fee = (total_prizes * PRIZE_FEE_PERCENT as u128) / 100;
                    let total_amount_to_send_old = total_prizes + total_transfer_fees;
                    let total_amount_to_send = total_prizes + total_transfer_fees + oc_fee;
                    let transaction_amount = t.units();

                    if transaction_amount != total_amount_to_send && transaction_amount != total_amount_to_send_old {
                        error!(
                            ?total_amount_to_send,
                            ?transaction_amount,
                            "Expected vs Actual prize transfer"
                        );
                        return InvalidRequest("Transaction amount must equal total prizes + total fees".to_string());
                    }

                    t.clone().set_memo(&MEMO_PRIZE)
                }
                _ => return InvalidRequest("Transaction must be of type 'Pending'".to_string()),
            }
        }
        MessageContentInitial::P2PSwap(p) => {
            let chat_canister_id = chat.canister_id();
            let create_swap_args = escrow_canister::create_swap::Args {
                location: P2PSwapLocation::from_message(chat, thread_root_message_index, message_id),
                token0: p.token0.clone(),
                token0_amount: p.token0_amount,
                token1: p.token1.clone(),
                token1_amount: p.token1_amount,
                expires_at: now + p.expires_in,
                additional_admins: vec![chat_canister_id],
                canister_to_notify: Some(chat_canister_id),
            };
            return P2PSwap(state.data.escrow_canister_id, create_swap_args);
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
    p2p_swap_id: Option<u32>,
    now: TimestampMillis,
) -> Result<Result<(MessageContentInternal, CompletedCryptoTransaction), String>, (RejectCode, String)> {
    match crate::crypto::process_transaction(pending_transaction).await {
        Ok(Ok(completed)) => {
            if let Some(id) = p2p_swap_id {
                NotifyEscrowCanisterOfDepositJob::run(id);
            }
            Ok(Ok((
                MessageContentInternal::new_with_transfer(content, completed.clone().into(), p2p_swap_id, now),
                completed,
            )))
        }
        Ok(Err(failed)) => Ok(Err(failed.error_message().to_string())),
        Err(error) => Err(error),
    }
}

pub(crate) async fn set_up_p2p_swap(
    escrow_canister_id: CanisterId,
    args: escrow_canister::create_swap::Args,
) -> Result<(u32, PendingCryptoTransaction), SetUpP2PSwapError> {
    use SetUpP2PSwapError::*;

    let id = match escrow_canister_c2c_client::create_swap(escrow_canister_id, &args).await {
        Ok(escrow_canister::create_swap::Response::Success(result)) => result.id,
        Ok(escrow_canister::create_swap::Response::InvalidSwap(message)) => return Err(InvalidSwap(message)),
        Err(error) => return Err(InternalError(format!("{error:?}"))),
    };

    mutate_state(|state| {
        let my_user_id = UserId::from(state.env.canister_id());
        let now = state.env.now();

        state.data.p2p_swaps.add(P2PSwap {
            id,
            location: args.location,
            created_by: my_user_id,
            created: now,
            token0: args.token0.clone(),
            token0_amount: args.token0_amount,
            token1: args.token1.clone(),
            token1_amount: args.token1_amount,
            expires_at: args.expires_at,
        });

        let pending_transfer = PendingCryptoTransaction::ICRC1(icrc1::PendingCryptoTransaction {
            ledger: args.token0.ledger,
            token: args.token0.token.clone(),
            amount: args.token0_amount + args.token0.fee,
            to: Account {
                owner: state.data.escrow_canister_id,
                subaccount: Some(deposit_subaccount(my_user_id, id)),
            },
            fee: args.token0.fee,
            memo: Some(MEMO_P2P_SWAP_CREATE.to_vec().into()),
            created: now * NANOS_PER_MILLISECOND,
        });

        Ok((id, pending_transfer))
    })
}

pub(crate) enum SetUpP2PSwapError {
    InvalidSwap(String),
    InternalError(String),
}

impl From<SetUpP2PSwapError> for send_message_with_transfer_to_channel::Response {
    fn from(value: SetUpP2PSwapError) -> Self {
        use send_message_with_transfer_to_channel::Response::*;
        match value {
            SetUpP2PSwapError::InvalidSwap(message) => InvalidRequest(message),
            SetUpP2PSwapError::InternalError(error) => P2PSwapSetUpFailed(error),
        }
    }
}

impl From<SetUpP2PSwapError> for send_message_with_transfer_to_group::Response {
    fn from(value: SetUpP2PSwapError) -> Self {
        use send_message_with_transfer_to_group::Response::*;
        match value {
            SetUpP2PSwapError::InvalidSwap(message) => InvalidRequest(message),
            SetUpP2PSwapError::InternalError(error) => P2PSwapSetUpFailed(error),
        }
    }
}

impl From<SetUpP2PSwapError> for send_message_v2::Response {
    fn from(value: SetUpP2PSwapError) -> Self {
        use send_message_v2::Response::*;
        match value {
            SetUpP2PSwapError::InvalidSwap(message) => InvalidRequest(message),
            SetUpP2PSwapError::InternalError(error) => P2PSwapSetUpFailed(error),
        }
    }
}

fn award_achievements(
    message_type_achievement: Option<Achievement>,
    message_index: MessageIndex,
    in_thread: bool,
    quote_reply: bool,
    state: &mut RuntimeState,
) {
    let mut achievements = Vec::new();

    if let Some(achievement) = message_type_achievement {
        achievements.push(achievement);
    }

    if quote_reply {
        achievements.push(Achievement::QuoteReplied);
    } else if in_thread && message_index == MessageIndex::from(0) {
        achievements.push(Achievement::RepliedInThread);
    }

    state.award_achievements_and_notify(achievements, state.env.now());
}
