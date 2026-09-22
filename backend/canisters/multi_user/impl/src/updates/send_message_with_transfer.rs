use crate::crypto::{release_transfer, use_transfer, verify_recipient, wallet_account};
use crate::guards::caller_is_hosted_user;
use crate::timer_job_types::{SendMessageToChannelJob, SendMessageToGroupJob};
use crate::{RuntimeState, mutate_state, read_state};
use candid::Principal;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::MessageContentInternal;
use constants::PRIZE_FEE_PERCENT;
use oc_error_codes::{OCError, OCErrorCode};
use types::{
    Achievement, Chat, CompletedCryptoTransaction, CryptoTransaction, MAX_TEXT_LENGTH, MAX_TEXT_LENGTH_USIZE,
    MessageContentInitial, MessageIndex, OCResult, PendingCryptoTransaction, UserId, icrc1,
};
use user_canister::{send_message_with_transfer_to_channel, send_message_with_transfer_to_group};

// The user has already made the transfer, so it is verified and then the message is sent to the
// group on the user's behalf
#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
async fn send_message_with_transfer_to_group(
    args: send_message_with_transfer_to_group::Args,
) -> send_message_with_transfer_to_group::Response {
    use send_message_with_transfer_to_group::Response::*;

    let chat = Chat::Group(args.group_id);
    let prepared = match read_state(|state| prepare(chat, args.thread_root_message_index, &args.content, state)) {
        Ok(ok) => ok,
        Err(PrepareError::NotInChat) => return CallerNotInGroup(None),
        Err(PrepareError::Error(error)) => return Error(error),
    };
    let my_index = prepared.my_index;
    let my_user_id = prepared.my_user_id;
    let (content, transfer) = match verify_transfer(prepared, args.content).await {
        Ok(ok) => ok,
        Err(error) => return Error(error),
    };
    let achievement = content.content_type().achievement();

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
        og_previews: args.og_previews,
        user_id: Some(my_user_id),
    };

    use group_canister::c2c_send_message::Response;
    match group_canister_c2c_client::c2c_send_message(args.group_id.into(), &c2c_args).await {
        Ok(Response::Success(r)) => {
            let in_thread = args.thread_root_message_index.is_some();
            let quote_reply = c2c_args.replies_to.is_some();
            award_achievements(my_index, achievement, r.message_index, in_thread, quote_reply);
            Success(send_message_with_transfer_to_group::SuccessResult {
                event_index: r.event_index,
                message_index: r.message_index,
                timestamp: r.timestamp,
                expires_at: r.expires_at,
                transfer: transfer.into(),
            })
        }
        Ok(Response::Error(error)) => Error(not_sent(&transfer, error)),
        Err(error) => {
            SendMessageToGroupJob {
                user_index: my_index,
                chat_id: args.group_id,
                args: c2c_args,
                attempt: 0,
            }
            .enqueue();
            Retrying(format!("{error:?}"), transfer.into())
        }
    }
}

// As `send_message_with_transfer_to_group`, for a channel
#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
async fn send_message_with_transfer_to_channel(
    args: send_message_with_transfer_to_channel::Args,
) -> send_message_with_transfer_to_channel::Response {
    use send_message_with_transfer_to_channel::Response::*;

    let chat = Chat::Channel(args.community_id, args.channel_id);
    let prepared = match read_state(|state| prepare(chat, args.thread_root_message_index, &args.content, state)) {
        Ok(ok) => ok,
        Err(PrepareError::NotInChat) => return UserNotInCommunity(None),
        Err(PrepareError::Error(error)) => return Error(error),
    };
    let my_index = prepared.my_index;
    let my_user_id = prepared.my_user_id;
    let (content, transfer) = match verify_transfer(prepared, args.content).await {
        Ok(ok) => ok,
        Err(error) => return Error(error),
    };
    let achievement = content.content_type().achievement();

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
        og_previews: args.og_previews,
        user_id: Some(my_user_id),
    };

    use community_canister::c2c_send_message::Response;
    match community_canister_c2c_client::c2c_send_message(args.community_id.into(), &c2c_args).await {
        Ok(Response::Success(r)) => {
            let in_thread = args.thread_root_message_index.is_some();
            let quote_reply = c2c_args.replies_to.is_some();
            award_achievements(my_index, achievement, r.message_index, in_thread, quote_reply);
            Success(send_message_with_transfer_to_channel::SuccessResult {
                event_index: r.event_index,
                message_index: r.message_index,
                timestamp: r.timestamp,
                expires_at: r.expires_at,
                transfer: transfer.into(),
            })
        }
        Ok(Response::Error(error)) => Error(not_sent(&transfer, error)),
        Err(error) => {
            SendMessageToChannelJob {
                user_index: my_index,
                community_id: args.community_id,
                args: c2c_args,
                attempt: 0,
            }
            .enqueue();
            Retrying(format!("{error:?}"), transfer.into())
        }
    }
}

// The chat refused the message, so the transfer is freed to be used again
fn not_sent(transfer: &icrc1::CompletedCryptoTransaction, error: OCError) -> OCError {
    mutate_state(|state| release_transfer(transfer, state));
    error
}

struct PrepareOk {
    my_index: u16,
    my_user_id: UserId,
    // Taken now since the caller isn't available once the endpoint has awaited a call
    my_principal: Principal,
    transfer: PendingCryptoTransaction,
    recipient: TransferRecipient,
}

// Who the transfer must be to
enum TransferRecipient {
    // The user's wallet, which is only known once it has been looked up
    User(UserId),
    Account(icrc1::Account),
}

enum PrepareError {
    NotInChat,
    Error(OCError),
}

impl From<OCError> for PrepareError {
    fn from(value: OCError) -> Self {
        PrepareError::Error(value)
    }
}

impl From<OCErrorCode> for PrepareError {
    fn from(value: OCErrorCode) -> Self {
        PrepareError::Error(value.into())
    }
}

fn prepare(
    chat: Chat,
    thread_root_message_index: Option<MessageIndex>,
    content: &MessageContentInitial,
    state: &RuntimeState,
) -> Result<PrepareOk, PrepareError> {
    let now = state.env.now();
    state.with_caller_user(|my_index, user| {
        let is_member = match chat {
            Chat::Group(group_id) => user.group_chats.exists(&group_id),
            Chat::Channel(community_id, _) => user.communities.exists(&community_id),
            Chat::Direct(_) => false,
        };
        if !is_member {
            return Err(PrepareError::NotInChat);
        }

        user.verify_not_suspended()?;

        if content.text_length() > MAX_TEXT_LENGTH_USIZE {
            return Err(OCErrorCode::TextTooLong.with_message(MAX_TEXT_LENGTH).into());
        }

        let my_user_id = state.user_id(my_index);
        let (transfer, recipient) = match content {
            MessageContentInitial::Crypto(c) => {
                if c.recipient == my_user_id {
                    return Err(OCErrorCode::TransferCannotBeToSelf.into());
                }
                if user.blocked_users.contains(&c.recipient) {
                    return Err(OCErrorCode::TargetUserBlocked.into());
                }
                let CryptoTransaction::Pending(t) = &c.transfer else {
                    return Err(OCErrorCode::InvalidRequest
                        .with_message("Transaction must be of type 'Pending'")
                        .into());
                };
                (t.clone(), TransferRecipient::User(c.recipient))
            }
            MessageContentInitial::Prize(c) => {
                if thread_root_message_index.is_some() {
                    return Err(OCErrorCode::InvalidRequest
                        .with_message("Prize messages cannot be sent within threads")
                        .into());
                }
                if c.end_date <= now {
                    return Err(OCErrorCode::InvalidRequest
                        .with_message("Prize end date must be in the future")
                        .into());
                }
                let CryptoTransaction::Pending(t) = &c.transfer else {
                    return Err(OCErrorCode::InvalidRequest
                        .with_message("Transaction must be of type 'Pending'")
                        .into());
                };
                let total_prizes = c.prizes_v2.iter().sum::<u128>();
                let total_transfer_fees = c.prizes_v2.len() as u128 * t.fee();
                let oc_fee = (total_prizes * PRIZE_FEE_PERCENT as u128) / 100;
                if t.units() != total_prizes + total_transfer_fees + oc_fee {
                    return Err(OCErrorCode::InvalidRequest
                        .with_message("Transaction amount must equal total prizes + total fees")
                        .into());
                }
                // The prizes are paid out by the chat's canister, so must be transferred to it
                (t.clone(), TransferRecipient::Account(chat.canister_id().into()))
            }
            // TODO: P2P swaps need the escrow canister, as in the User canister
            MessageContentInitial::P2PSwap(_) => {
                return Err(OCErrorCode::InvalidRequest
                    .with_message("P2P swaps are not yet supported by the MultiUser canister")
                    .into());
            }
            _ => {
                return Err(OCErrorCode::InvalidRequest
                    .with_message("Message must include a crypto transfer")
                    .into());
            }
        };

        if transfer.is_zero() {
            return Err(OCErrorCode::TransferCannotBeZero.into());
        }

        Ok(PrepareOk {
            my_index,
            my_user_id,
            my_principal: user.principal,
            transfer,
            recipient,
        })
    })
}

// Checks the transfer is to who it must be, then verifies it and records it as used, returning the
// message content holding the completed transfer
async fn verify_transfer(
    prepared: PrepareOk,
    content: MessageContentInitial,
) -> OCResult<(MessageContentInternal, icrc1::CompletedCryptoTransaction)> {
    let expected = match prepared.recipient {
        TransferRecipient::User(user_id) => wallet_account(user_id).await?,
        TransferRecipient::Account(account) => account,
    };
    verify_recipient(&prepared.transfer, expected)?;

    mutate_state(|state| {
        let completed = use_transfer(prepared.transfer, prepared.my_principal, state)?;
        let content = MessageContentInternal::new_with_transfer(
            content,
            CompletedCryptoTransaction::ICRC1(completed.clone()).into(),
            None,
            state.env.now(),
        );
        Ok((content, completed))
    })
}

fn award_achievements(
    my_index: u16,
    message_type_achievement: Option<Achievement>,
    message_index: MessageIndex,
    in_thread: bool,
    quote_reply: bool,
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

    mutate_state(|state| state.award_achievements_and_notify(my_index, achievements, state.env.now()));
}
