use crate::crypto::user_wallet;
use crate::guards::{caller_is_hosted_user, caller_is_local_user_index};
use crate::timer_job_types::{
    CancelP2PSwapInEscrowCanisterJob, MarkP2PSwapExpiredJob, NotifyEscrowCanisterOfDepositJob, TimerJob,
};
use crate::{MultiUserEventPusher, RuntimeState, look_up_direct_chat_user, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::{
    MessageContentInternal, NullEventPusher, PushMessageArgs, Reader, ReplyContextInternal, ValidateNewMessageContentResult,
};
use constants::{MEMO_MESSAGE, MEMO_P2P_SWAP_CREATE, NANOS_PER_MILLISECOND, OPENCHAT_BOT_USER_ID};
use ledger_utils::UserTransfer;
use oc_error_codes::OCErrorCode;
use rand::RngExt;
use types::{
    CanisterId, Chat, ChatId, CompletedCryptoTransaction, CryptoContent, DirectChatUserNotificationPayload,
    DirectMessageNotification, MessageContentInitial, MessageId, MessageIndex, OCResult, OgPreview, P2PSwapContentInitial,
    P2PSwapLocation, PinNumberWrapper, ReplyContext, TimestampMillis, UserId, UserType, certified, icrc1, icrc2,
};
use user_canister::send_message_v2::{Response::*, *};
use user_canister::{C2CReplyContext, SendMessageArgs, SendMessagesArgs, UserCanisterEvent, c2c_bot_send_message};
use user_core::updates::c2c_bot_send_message::Sent;
use user_core::updates::offer_p2p_swap;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
// The User canister's `send_message_v2`. A message holding crypto is sent with a transfer the user
// makes from their own wallet, since this canister doesn't hold its users' funds: either pulled by
// this canister via ICRC2, against an approval made under the user's own spender subaccount (see
// `ledger_utils::spender_subaccount`), or already made by the user and certified (see
// `ledger_utils::UserTransfer`).
async fn send_message(args: Args) -> Response {
    send_message_impl_async(args).await
}

async fn send_message_impl_async(mut args: Args) -> Response {
    let PrepareOk {
        my_index,
        my_user_id,
        now,
        local_user_index_canister_id,
        maybe_recipient,
    } = match read_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(error) => return Error(error),
    };

    // As in the User canister, a recipient in another canister whom the sender has no chat with yet
    // is looked up in the LocalUserIndex
    let recipient = if let Some(recipient) = maybe_recipient {
        recipient
    } else {
        match look_up_direct_chat_user(local_user_index_canister_id, args.recipient).await {
            Ok(()) => Recipient::OtherCanister,
            Err(error) => return Error(error),
        }
    };

    let content = match MessageContentInternal::validate_new_message(args.content, true, UserType::User, args.forwarding, now) {
        ValidateNewMessageContentResult::Success(content) => MessageContent::Other(content),
        ValidateNewMessageContentResult::SuccessCrypto(content) => {
            match prepare_crypto_transfer(
                &content,
                my_index,
                args.recipient,
                recipient,
                local_user_index_canister_id,
                &mut args.pin,
            )
            .await
            {
                Ok((UserTransfer::Icrc2(transfer), spender_subaccount)) => {
                    match ledger_utils::icrc2::process_transaction_for_user(transfer, spender_subaccount).await {
                        Ok(Ok(completed)) => {
                            MessageContent::Crypto(Box::new((content, CryptoTransfer::Completed(completed.into()))))
                        }
                        Ok(Err((_, error))) => return Error(error),
                        Err(error) => return Error(error.into()),
                    }
                }
                Ok((UserTransfer::Certified(transfer), _)) => {
                    MessageContent::Crypto(Box::new((content, CryptoTransfer::Certified(transfer))))
                }
                Err(error) => return Error(error),
            }
        }
        ValidateNewMessageContentResult::SuccessP2PSwap(content) => {
            match offer_p2p_swap(content, my_index, my_user_id, args.recipient, args.message_id).await {
                Ok((content, completed)) => MessageContent::P2PSwap(Box::new((content, completed))),
                Err(error) => return Error(error),
            }
        }
        ValidateNewMessageContentResult::SuccessPrize(_) => unreachable!(),
        ValidateNewMessageContentResult::Error(error) => {
            return Error(OCErrorCode::InvalidMessageContent.with_json(&error));
        }
    };

    let p2p_swap_id = match &content {
        MessageContent::P2PSwap(swap) => match &swap.0 {
            MessageContentInternal::P2PSwap(c) => Some(c.swap_id),
            _ => None,
        },
        _ => None,
    };

    let response = mutate_state(|state| {
        let now = state.env.now();
        let (content, transfer, certified) = match content {
            MessageContent::Other(content) => (content, None, None),
            MessageContent::P2PSwap(swap) => {
                let (content, completed) = *swap;
                (content, Some(completed), None)
            }
            MessageContent::Crypto(crypto) => {
                let (content, transfer) = *crypto;
                let (completed, certified) = match transfer {
                    CryptoTransfer::Completed(completed) => (completed, None),
                    // The certified transfer is verified in the same execution as the message is
                    // sent, so that it is only recorded as used once the message has been sent
                    CryptoTransfer::Certified(transfer) => {
                        let Some(sender) = state.data.users.with_user(my_index, |user| user.principal) else {
                            return Error(OCErrorCode::InitiatorNotFound.into());
                        };
                        match state.data.certified_transfers.verify(
                            transfer,
                            sender,
                            &MEMO_MESSAGE,
                            state.env.canister_id(),
                            &state.env.ic_root_key(),
                            now,
                        ) {
                            Ok(completed) => (completed.clone().into(), Some(completed)),
                            Err(error) => return Error(error),
                        }
                    }
                };
                let content = MessageContentInternal::new_with_transfer(
                    MessageContentInitial::Crypto(content),
                    completed.clone().into(),
                    None,
                    now,
                );
                (content, Some(completed), certified)
            }
        };

        let response = send_message_impl(
            my_index,
            my_user_id,
            args.recipient,
            args.thread_root_message_index,
            args.message_id,
            content,
            args.replies_to,
            args.forwarding,
            args.block_level_markdown,
            args.message_filter_failed,
            recipient,
            args.og_previews,
            transfer,
            state,
        );

        if let Some(completed) = certified
            && !matches!(response, Error(_))
        {
            state.data.certified_transfers.mark_used(&completed, now);
        }
        response
    });

    // A swap whose message couldn't be sent is cancelled, which refunds the deposit made for it
    if let Some(swap_id) = p2p_swap_id
        && matches!(response, Error(_))
    {
        CancelP2PSwapInEscrowCanisterJob::run(swap_id);
    }
    response
}

// A message's validated content, with the transfer it holds, if any
#[expect(clippy::large_enum_variant)]
enum MessageContent {
    Other(MessageContentInternal),
    Crypto(Box<(CryptoContent, CryptoTransfer)>),
    // Its token0 already deposited into the escrow canister
    P2PSwap(Box<(MessageContentInternal, CompletedCryptoTransaction)>),
}

enum CryptoTransfer {
    Completed(CompletedCryptoTransaction),
    // Made by the user already, but only verified when the message is sent
    Certified(certified::PendingCryptoTransaction),
}

// Checks a crypto transfer is to the recipient's wallet, and is one this canister can submit for the
// user. Users hold their own funds in their own wallets, so this canister can't make an NNS or ICRC1
// transfer for them, only pull their funds via ICRC2, or accept a transfer they have already made.
async fn prepare_crypto_transfer(
    content: &CryptoContent,
    my_index: u16,
    them: UserId,
    recipient: Recipient,
    local_user_index_canister_id: CanisterId,
    pin: &mut Option<PinNumberWrapper>,
) -> OCResult<(UserTransfer, [u8; 32])> {
    // Crypto in a direct chat can only be sent to the other user in the chat
    if content.recipient != them {
        return Err(OCErrorCode::RecipientMismatch.into());
    }

    // A user in this canister holds their funds under their own principal
    let recipient_wallet: icrc1::Account = match recipient {
        Recipient::Me => read_state(|state| state.data.users.with_user(my_index, |user| user.principal))
            .ok_or(OCErrorCode::InitiatorNotFound)?
            .into(),
        Recipient::SameCanister(their_index) => {
            read_state(|state| state.data.users.with_user(their_index, |user| user.principal))
                .ok_or(OCErrorCode::TargetUserNotFound)?
                .into()
        }
        Recipient::OtherCanister => user_wallet(content.recipient, local_user_index_canister_id).await?,
    };

    mutate_state(|state| {
        let now = state.env.now();
        // The sender approved any transfer this canister pulls for them under the spender subaccount
        // derived from their principal, which is read here since the caller can't be after an await
        let my_principal = state
            .data
            .users
            .with_user_mut(my_index, |user| {
                user.pin_number.verify(pin.as_mut(), now).map(|_| user.principal)
            })
            .ok_or(OCErrorCode::InitiatorNotFound)??;

        let transfer = UserTransfer::new(
            content.transfer.clone(),
            recipient_wallet,
            &MEMO_MESSAGE,
            state.env.canister_id(),
        )?;
        Ok((transfer, ledger_utils::spender_subaccount(my_principal)))
    })
}

// The User canister's `c2c_bot_send_message`, naming the user the bot is messaging since this
// canister holds many users
#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_bot_send_message(args: c2c_bot_send_message::Args) -> c2c_bot_send_message::Response {
    mutate_state(|state| c2c_bot_send_message_impl(args, state))
}

fn c2c_bot_send_message_impl(args: c2c_bot_send_message::Args, state: &mut RuntimeState) -> c2c_bot_send_message::Response {
    let Some(user_index) = state.index_of_local_user(args.user_id) else {
        return c2c_bot_send_message::Response::Error(OCErrorCode::TargetUserNotFound.into());
    };
    let my_user_id = state.user_id(user_index);
    let bot_id = args.bot_id;
    let now = state.env.now();
    // Drawn up front, whether or not the chat turns out to need creating, since the user is
    // borrowed for the whole of the call below
    let anonymized_chat_id: u128 = state.env.rng().random();

    let event_pusher = MultiUserEventPusher {
        user_id: my_user_id,
        now,
        rng: state.env.rng(),
        queue: &mut state.data.local_user_index_event_sync_queue,
    };
    let result = state.data.users.with_user_mut(user_index, |user| {
        let message = user_core::updates::c2c_bot_send_message::prepare(user, args, now)?;
        user_core::updates::c2c_bot_send_message::send(
            user,
            my_user_id,
            message,
            || anonymized_chat_id,
            Some(event_pusher),
            now,
        )
    });
    let Sent {
        result,
        notification,
        new_message,
    } = match result {
        Some(Ok(sent)) => sent,
        Some(Err(error)) => return c2c_bot_send_message::Response::Error(error),
        None => return c2c_bot_send_message::Response::Error(OCErrorCode::TargetUserNotFound.into()),
    };

    if let Some(notification) = notification {
        state.push_notification(Some(bot_id), user_index, notification, now);
    }

    if let Some((message_event, _)) = new_message
        && let Some(expiry) = message_event.expires_at
    {
        state.handle_event_expiry(user_index, expiry);
    }

    c2c_bot_send_message::Response::Success(result)
}

// Offers a swap in a direct chat, as the User canister does: creates the swap in the escrow canister
// and deposits token0 into it. Users hold their own funds in their own wallets, so the deposit is
// pulled from the user's wallet (or the account they name) via ICRC2, against an approval made under
// their own spender subaccount. The escrow canister knows the user by their principal, which is
// named as the offerer since it is this canister which creates the swap, and this canister, as its
// creator, may cancel it for them.
async fn offer_p2p_swap(
    content: P2PSwapContentInitial,
    my_index: u16,
    my_user_id: UserId,
    recipient: UserId,
    message_id: MessageId,
) -> OCResult<(MessageContentInternal, CompletedCryptoTransaction)> {
    let (my_principal, escrow_canister_id, now) = read_state(|state| {
        let now = state.env.now();
        let my_principal = state
            .data
            .users
            .with_user(my_index, |user| {
                if user.membership(now).is_diamond_member() {
                    Ok(user.principal)
                } else {
                    Err(OCErrorCode::NotDiamondMember)
                }
            })
            .ok_or(OCErrorCode::InitiatorNotFound)??;
        ledger_utils::validate_from_account(content.from_account, state.env.canister_id())?;
        OCResult::Ok((my_principal, state.data.escrow_canister_id, now))
    })?;

    let create_swap_args = escrow_canister::create_swap::Args {
        location: P2PSwapLocation::from_message(Chat::Direct(recipient.into()), None, message_id),
        token0: content.token0.clone(),
        token0_amount: content.token0_amount,
        token0_principal: Some(my_principal),
        token1: content.token1.clone(),
        token1_amount: content.token1_amount,
        token1_principal: None,
        expires_at: now + content.expires_in,
        additional_admins: Vec::new(),
        canister_to_notify: Some(recipient.canister_id()),
        is_public: false,
    };
    let swap_id = offer_p2p_swap::create_swap(escrow_canister_id, &create_swap_args).await?;

    let recorded = mutate_state(|state| {
        let now = state.env.now();
        state
            .data
            .users
            .with_user_mut(my_index, |user| {
                user.p2p_swaps
                    .add(offer_p2p_swap::swap_offered(swap_id, &create_swap_args, my_user_id, now))
            })
            .is_some()
    });
    // The user was deleted while the swap was being created, so it is cancelled before any of their
    // funds are deposited into it
    if !recorded {
        CancelP2PSwapInEscrowCanisterJob::run(swap_id);
        return Err(OCErrorCode::InitiatorNotFound.into());
    }

    let deposit = icrc2::PendingCryptoTransaction {
        ledger: content.token0.ledger,
        token_symbol: content.token0.symbol.clone(),
        amount: content.token0_amount + content.token0.fee,
        from: content.from_account.unwrap_or(my_principal.into()),
        to: offer_p2p_swap::deposit_account(escrow_canister_id, my_principal, swap_id),
        fee: content.token0.fee,
        memo: Some(MEMO_P2P_SWAP_CREATE.to_vec().into()),
        created: now * NANOS_PER_MILLISECOND,
    };
    let completed: CompletedCryptoTransaction = match ledger_utils::icrc2::process_transaction_for_user(
        deposit,
        ledger_utils::spender_subaccount(my_principal),
    )
    .await
    {
        Ok(Ok(completed)) => completed.into(),
        Ok(Err((_, error))) => return Err(error),
        Err(error) => return Err(error.into()),
    };
    NotifyEscrowCanisterOfDepositJob::run(swap_id, my_principal);

    let content = MessageContentInternal::new_with_transfer(
        MessageContentInitial::P2PSwap(content),
        completed.clone().into(),
        Some(swap_id),
        read_state(|state| state.env.now()),
    );
    Ok((content, completed))
}

// Marks a swap offered in a message expired in one user's copy of the chat once its time is up, as
// the User canister does for each copy
fn register_p2p_swap_expiry(
    user_index: u16,
    chat_id: ChatId,
    thread_root_message_index: Option<MessageIndex>,
    message_id: MessageId,
    expires_at: TimestampMillis,
    now: TimestampMillis,
    state: &mut RuntimeState,
) {
    state.data.timer_jobs.enqueue_job(
        TimerJob::MarkP2PSwapExpired(Box::new(MarkP2PSwapExpiredJob {
            user_index,
            chat_id,
            thread_root_message_index,
            message_id,
        })),
        expires_at,
        now,
    );
}

struct PrepareOk {
    my_index: u16,
    my_user_id: UserId,
    now: TimestampMillis,
    local_user_index_canister_id: CanisterId,
    // None if the recipient is in another canister and the sender has no chat with them yet, in
    // which case they must be looked up before the message is sent
    maybe_recipient: Option<Recipient>,
}

fn prepare(args: &Args, state: &RuntimeState) -> OCResult<PrepareOk> {
    let my_index = state.caller_user_index().ok_or(OCErrorCode::InitiatorNotAuthorized)?;
    let my_user_id = state.user_id(my_index);

    if args.recipient == OPENCHAT_BOT_USER_ID {
        return Err(OCErrorCode::InvalidRequest.with_message("Messaging the OpenChat Bot is not currently supported"));
    }

    state
        .with_user(my_user_id, |user| -> OCResult<Option<Recipient>> {
            user.verify_not_suspended()?;

            if user.blocked_users.contains(&args.recipient) {
                return Err(OCErrorCode::TargetUserBlocked.into());
            }

            let chat = user.direct_chats.get(&args.recipient.into());
            if chat.is_some_and(|chat| {
                chat.events()
                    .message_already_finalised(args.thread_root_message_index, args.message_id, false)
            }) {
                return Err(OCErrorCode::MessageIdAlreadyExists.into());
            }

            // Checked before any transfer is made for the message, so that funds aren't moved for a
            // message which can't then be sent
            if args.thread_root_message_index.is_some() {
                chat.ok_or(OCErrorCode::ThreadNotFound)?
                    .thread_root_message_id(args.thread_root_message_index)?;
            }

            Ok(if args.recipient == my_user_id {
                Some(Recipient::Me)
            } else if let Some(index) = state.index_of_local_user(args.recipient) {
                Some(Recipient::SameCanister(index))
            } else if state.user_index(args.recipient).is_some() {
                // An index in this canister which holds no user
                return Err(OCErrorCode::TargetUserNotFound.into());
            } else {
                chat.is_some().then_some(Recipient::OtherCanister)
            })
        })?
        .map(|maybe_recipient| PrepareOk {
            my_index,
            my_user_id,
            now: state.env.now(),
            local_user_index_canister_id: state.data.local_user_index_canister_id,
            maybe_recipient,
        })
}

#[expect(clippy::too_many_arguments)]
fn send_message_impl(
    my_index: u16,
    my_user_id: UserId,
    recipient: UserId,
    thread_root_message_index: Option<MessageIndex>,
    message_id: MessageId,
    content: MessageContentInternal,
    replies_to: Option<ReplyContext>,
    forwarding: bool,
    block_level_markdown: bool,
    message_filter_failed: Option<u64>,
    recipient_kind: Recipient,
    og_previews: Vec<OgPreview>,
    transfer: Option<CompletedCryptoTransaction>,
    state: &mut RuntimeState,
) -> Response {
    let now = state.env.now();

    // TODO: Record replies to messages in other chats (`mark_private_reply`)
    let push_message_args = PushMessageArgs {
        thread_root_message_index,
        message_id,
        sender: my_user_id,
        content: content.clone(),
        mentioned: Vec::new(),
        replies_to: replies_to.as_ref().map(ReplyContextInternal::from),
        forwarded: forwarding,
        sender_is_bot: false,
        block_level_markdown,
        og_previews: og_previews.clone(),
        now,
        sender_context: None,
    };

    let chat_id = recipient.into();
    // Drawn up front, whether or not the chat turns out to need creating, since the user is
    // borrowed for the whole of the closure below
    let anonymized_id: u128 = state.env.rng().random();

    // Push the message to the sender's copy of the chat, creating the chat if they have none
    let result = state.data.users.with_user_mut(my_index, |user| {
        let chat = user
            .direct_chats
            .get_or_create(my_user_id, recipient, UserType::User, || anonymized_id, now);

        // Checked before the message is pushed, since pushing a message to a thread creates the thread
        let thread_root_message_id = chat.thread_root_message_id(thread_root_message_index)?;

        // TODO: Push the message to the event store (`UserEventPusher` in the User canister)
        let message_event = chat.push_message::<NullEventPusher>(push_message_args, None, None);

        // The message as the recipient's copy of the chat receives it: message ids are the same in
        // both copies while the indexes are not, so what the reply is to and which thread it is in
        // are given by id (as in the User canister's `send_message`)
        let replies_to = replies_to.and_then(|r| {
            if let Some((chat, thread_root_message_index)) = r.chat_if_other {
                Some(C2CReplyContext::OtherChat(chat, thread_root_message_index, r.event_index))
            } else {
                chat.main_events_reader()
                    .message_internal(r.event_index.into())
                    .map(|m| C2CReplyContext::ThisChat(m.message_id))
            }
        });
        let message_for_recipient = SendMessageArgs {
            thread_root_message_id,
            message_id,
            sender_message_index: message_event.event.message_index,
            content,
            replies_to,
            forwarding,
            block_level_markdown,
            message_filter_failed,
            og_previews,
        };
        let sender_details = SenderDetails {
            name: user.username.value.clone(),
            display_name: user.display_name.value.clone(),
            avatar_id: user.avatar.id(),
        };
        Ok((message_event, message_for_recipient, sender_details))
    });

    let (message_event, message_for_recipient, sender_details) = match result {
        Some(Ok(ok)) => ok,
        Some(Err(error)) => return Error(error),
        // The sender was deleted while the recipient was being looked up
        None => return Error(OCErrorCode::InitiatorNotFound.into()),
    };

    // A recipient in this canister gets the message straight away, while one in another canister is
    // sent it via a call to their canister. A chat with yourself has a single copy, so there is
    // nothing more to do.
    match recipient_kind {
        Recipient::Me => {}
        Recipient::SameCanister(their_index) => {
            receive_message(their_index, my_user_id, sender_details, message_for_recipient, now, state);
        }
        Recipient::OtherCanister => {
            state.push_user_canister_event(
                my_index,
                recipient,
                UserCanisterEvent::SendMessages(Box::new(SendMessagesArgs {
                    messages: vec![message_for_recipient],
                    sender_name: sender_details.name,
                    sender_display_name: sender_details.display_name,
                    sender_avatar_id: sender_details.avatar_id,
                })),
            );
        }
    }

    // As in the User canister, messages sent to yourself earn no achievements
    if !matches!(recipient_kind, Recipient::Me) {
        state.award_achievements_and_notify(my_index, message_event.event.achievements(true, false), now);
    }

    if let Some(expiry) = message_event.expires_at {
        state.handle_event_expiry(my_index, expiry);
    }

    if let types::MessageContent::P2PSwap(c) = &message_event.event.content {
        register_p2p_swap_expiry(
            my_index,
            chat_id,
            thread_root_message_index,
            message_id,
            c.expires_at,
            now,
            state,
        );
    }

    if let Some(transfer) = transfer {
        TransferSuccessV2(TransferSuccessV2Result {
            chat_id,
            event_index: message_event.index,
            message_index: message_event.event.message_index,
            timestamp: now,
            expires_at: message_event.expires_at,
            transfer,
        })
    } else {
        Success(SuccessResult {
            chat_id,
            event_index: message_event.index,
            message_index: message_event.event.message_index,
            timestamp: now,
            expires_at: message_event.expires_at,
        })
    }
}

// What the recipient's notification of a message shows of its sender
pub(crate) struct SenderDetails {
    pub name: String,
    pub display_name: Option<String>,
    pub avatar_id: Option<u128>,
}

// Who a message is to, relative to its sender
#[derive(Clone, Copy)]
enum Recipient {
    // The sender's chat with themselves
    Me,
    // Another user in this canister
    SameCanister(u16),
    // A user in another canister
    OtherCanister,
}

// Pushes a message from `sender`, another user in this canister, to the recipient's copy of the
// chat between them, creating the chat if they have none. This is the User canister's handling of
// the `SendMessages` event it receives from the sender's canister, applied directly. As there, a
// message the recipient doesn't receive (because they have blocked the sender, or it is in a
// thread their copy of the chat doesn't have) stays on the sender's side alone.
pub(crate) fn receive_message(
    their_index: u16,
    sender: UserId,
    sender_details: SenderDetails,
    message: SendMessageArgs,
    now: TimestampMillis,
    state: &mut RuntimeState,
) {
    let their_user_id = state.user_id(their_index);
    let chat_id = sender.into();
    let anonymized_id: u128 = state.env.rng().random();
    let mute_notification = message.message_filter_failed.is_some();
    let message_id = message.message_id;

    let received = state.data.users.with_user_mut(their_index, |user| {
        if user.blocked_users.contains(&sender) {
            return None;
        }

        let existing_chat = user.direct_chats.get(&chat_id);

        // Which thread the message is in and what it replies to are translated from ids to the
        // indexes they have in this copy of the chat
        let thread_root_message_index = match existing_chat {
            Some(chat) => chat.thread_root_message_index(message.thread_root_message_id),
            None if message.thread_root_message_id.is_none() => Ok(None),
            None => Err(OCErrorCode::ThreadNotFound.into()),
        };
        let Ok(thread_root_message_index) = thread_root_message_index else {
            return None;
        };

        // The sender can only reuse a message id in a chat they have deleted their copy of, in
        // which case this copy may still hold the id
        if existing_chat.is_some_and(|chat| {
            chat.events()
                .message_already_finalised(thread_root_message_index, message.message_id, false)
        }) {
            return None;
        }

        let replies_to = match message.replies_to {
            Some(C2CReplyContext::ThisChat(message_id)) => existing_chat
                .and_then(|chat| chat.main_events_reader().event_index(message_id.into()))
                .map(|event_index| ReplyContextInternal {
                    chat_if_other: None,
                    event_index,
                }),
            Some(C2CReplyContext::OtherChat(chat, thread_root_message_index, event_index)) => Some(ReplyContextInternal {
                chat_if_other: Some((chat.into(), thread_root_message_index)),
                event_index,
            }),
            None => None,
        };

        let chat = user
            .direct_chats
            .get_or_create(their_user_id, sender, UserType::User, || anonymized_id, now);

        let message_event = chat.push_message::<NullEventPusher>(
            PushMessageArgs {
                thread_root_message_index,
                message_id: message.message_id,
                sender,
                content: message.content,
                mentioned: Vec::new(),
                replies_to,
                forwarded: message.forwarding,
                sender_is_bot: false,
                block_level_markdown: message.block_level_markdown,
                og_previews: message.og_previews,
                now,
                sender_context: None,
            },
            Some(message.sender_message_index),
            None,
        );

        // TODO: Record replies to messages in other chats and message activity, as the User
        // canister does

        let notification = if mute_notification || chat.notifications_muted.value || user.suspended.value {
            None
        } else {
            let content = &message_event.event.content;
            Some(DirectChatUserNotificationPayload::DirectMessage(DirectMessageNotification {
                sender,
                thread_root_message_index,
                message_index: message_event.event.message_index,
                event_index: message_event.index,
                sender_name: sender_details.name,
                sender_display_name: sender_details.display_name,
                message_type: content.content_type().to_string(),
                message_text: content.notification_text(&[], &[]),
                image_url: content.notification_image_url(),
                file_name: content.notification_file_name(),
                sender_avatar_id: sender_details.avatar_id,
                crypto_transfer: content.notification_crypto_transfer_details(&[]),
                call: None,
            }))
        };

        let p2p_swap_expires_at = match &message_event.event.content {
            types::MessageContent::P2PSwap(c) => Some(c.expires_at),
            _ => None,
        };
        Some((
            message_event.expires_at,
            notification,
            thread_root_message_index,
            p2p_swap_expires_at,
        ))
    });

    let Some((expires_at, notification, thread_root_message_index, p2p_swap_expires_at)) = received.flatten() else {
        return;
    };

    if let Some(p2p_swap_expires_at) = p2p_swap_expires_at {
        register_p2p_swap_expiry(
            their_index,
            chat_id,
            thread_root_message_index,
            message_id,
            p2p_swap_expires_at,
            now,
            state,
        );
    }

    // The recipient's copy of the chat has its own time to live, so the message may expire at a
    // different time in each copy
    if let Some(expiry) = expires_at {
        state.handle_event_expiry(their_index, expiry);
    }

    if let Some(notification) = notification {
        state.push_notification(Some(sender), their_index, notification, now);
    }
}
