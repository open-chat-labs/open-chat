use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::{
    MessageContentInternal, NullEventPusher, PushMessageArgs, Reader, ReplyContextInternal, ValidateNewMessageContentResult,
};
use constants::OPENCHAT_BOT_USER_ID;
use oc_error_codes::OCErrorCode;
use rand::RngExt;
use types::{DirectChatUserNotificationPayload, DirectMessageNotification, OCResult, TimestampMillis, UserId, UserType};
use user_canister::send_message_v2::{Response::*, *};
use user_canister::{C2CReplyContext, SendMessageArgs, c2c_bot_send_message};

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
async fn send_message_v2(args: Args) -> Response {
    // TODO: This is async because the User canister looks up recipients it has no chat with in
    // the LocalUserIndex and processes crypto transfers and P2P swaps, none of which is done yet
    mutate_state(|state| send_message_v2_impl(args, state))
}

#[update(msgpack = true)]
#[trace]
fn c2c_bot_send_message(_args: c2c_bot_send_message::Args) -> c2c_bot_send_message::Response {
    unimplemented!()
}

fn send_message_v2_impl(args: Args, state: &mut RuntimeState) -> Response {
    let PrepareOk {
        my_index,
        my_user_id,
        recipient,
        now,
    } = match prepare(&args, state) {
        Ok(ok) => ok,
        Err(error) => return Error(error),
    };

    let content = match MessageContentInternal::validate_new_message(args.content, true, UserType::User, args.forwarding, now) {
        ValidateNewMessageContentResult::Success(content) => content,
        // TODO: Crypto transfers need the user's pin number and the ledger calls, and P2P swaps the
        // escrow canister, as in the User canister
        ValidateNewMessageContentResult::SuccessCrypto(_) | ValidateNewMessageContentResult::SuccessP2PSwap(_) => {
            return Error(
                OCErrorCode::InvalidRequest
                    .with_message("Messages with transfers are not yet supported by the MultiUser canister"),
            );
        }
        ValidateNewMessageContentResult::SuccessPrize(_) => unreachable!(),
        ValidateNewMessageContentResult::Error(error) => {
            return Error(OCErrorCode::InvalidMessageContent.with_json(&error));
        }
    };

    // TODO: Record replies to messages in other chats (`mark_private_reply`)
    let push_message_args = PushMessageArgs {
        thread_root_message_index: args.thread_root_message_index,
        message_id: args.message_id,
        sender: my_user_id,
        content: content.clone(),
        mentioned: Vec::new(),
        replies_to: args.replies_to.as_ref().map(ReplyContextInternal::from),
        forwarded: args.forwarding,
        sender_is_bot: false,
        block_level_markdown: args.block_level_markdown,
        og_previews: args.og_previews.clone(),
        now,
        sender_context: None,
    };

    let chat_id = args.recipient.into();
    // Drawn up front, whether or not the chat turns out to need creating, since the user is
    // borrowed for the whole of the closure below
    let anonymized_id: u128 = state.env.rng().random();

    // Push the message to the sender's copy of the chat, creating the chat if they have none
    let result = state.data.users.with_user_mut(my_index, |user| {
        let chat = user
            .direct_chats
            .get_or_create(my_user_id, args.recipient, UserType::User, || anonymized_id, now);

        // Checked before the message is pushed, since pushing a message to a thread creates the thread
        let thread_root_message_id = chat.thread_root_message_id(args.thread_root_message_index)?;

        // TODO: Push the message to the event store (`UserEventPusher` in the User canister)
        let message_event = chat.push_message::<NullEventPusher>(push_message_args, None, None);

        // The message as the recipient's copy of the chat receives it: message ids are the same in
        // both copies while the indexes are not, so what the reply is to and which thread it is in
        // are given by id (as in the User canister's `send_message`)
        let replies_to = args.replies_to.and_then(|r| {
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
            message_id: args.message_id,
            sender_message_index: message_event.event.message_index,
            content,
            replies_to,
            forwarding: args.forwarding,
            block_level_markdown: args.block_level_markdown,
            message_filter_failed: args.message_filter_failed,
            og_previews: args.og_previews,
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
        None => return Error(OCErrorCode::TargetUserNotFound.into()),
    };

    // A recipient in this canister gets the message straight away, rather than via a call to their
    // canister. A chat with yourself has a single copy, so there is nothing more to do.
    if let Recipient::SameCanister(their_index) = recipient {
        receive_message(their_index, my_user_id, sender_details, message_for_recipient, now, state);
    }

    if let Some(expiry) = message_event.expires_at {
        state.handle_event_expiry(my_index, expiry);
    }

    // TODO: Award achievements, as the User canister does

    Success(SuccessResult {
        chat_id,
        event_index: message_event.index,
        message_index: message_event.event.message_index,
        timestamp: now,
        expires_at: message_event.expires_at,
    })
}

// What the recipient's notification of a message shows of its sender
struct SenderDetails {
    name: String,
    display_name: Option<String>,
    avatar_id: Option<u128>,
}

// Who a message is to, relative to its sender
#[derive(Clone, Copy)]
enum Recipient {
    // The sender's chat with themselves
    Me,
    // Another user in this canister
    SameCanister(u16),
}

struct PrepareOk {
    my_index: u16,
    my_user_id: UserId,
    recipient: Recipient,
    now: TimestampMillis,
}

fn prepare(args: &Args, state: &RuntimeState) -> OCResult<PrepareOk> {
    let my_index = state.caller_user_index().ok_or(OCErrorCode::InitiatorNotAuthorized)?;
    let my_user_id = state.user_id(my_index);
    let now = state.env.now();

    if args.recipient == OPENCHAT_BOT_USER_ID {
        return Err(OCErrorCode::InvalidRequest.with_message("Messaging the OpenChat Bot is not currently supported"));
    }

    let recipient = if args.recipient == my_user_id {
        Recipient::Me
    } else if let Some(index) = state.local_user_index(args.recipient) {
        Recipient::SameCanister(index)
    } else {
        // TODO: Users in other canisters, including bots, need the recipient looked up in the
        // LocalUserIndex when there is no chat with them yet, and the message sent on to their
        // canister
        return Err(OCErrorCode::InvalidRequest
            .with_message("Sending messages to users in other canisters is not yet supported by the MultiUser canister"));
    };

    state.with_user(my_user_id, |user| -> OCResult<()> {
        user.verify_not_suspended()?;

        if user.blocked_users.contains(&args.recipient) {
            return Err(OCErrorCode::TargetUserBlocked.into());
        }

        if user.direct_chats.get(&args.recipient.into()).is_some_and(|chat| {
            chat.events()
                .message_already_finalised(args.thread_root_message_index, args.message_id, false)
        }) {
            return Err(OCErrorCode::MessageIdAlreadyExists.into());
        }
        Ok(())
    })??;

    Ok(PrepareOk {
        my_index,
        my_user_id,
        recipient,
        now,
    })
}

// Pushes a message from `sender`, another user in this canister, to the recipient's copy of the
// chat between them, creating the chat if they have none. This is the User canister's handling of
// the `SendMessages` event it receives from the sender's canister, applied directly. As there, a
// message the recipient doesn't receive (because they have blocked the sender, or it is in a
// thread their copy of the chat doesn't have) stays on the sender's side alone.
fn receive_message(
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
            }))
        };

        Some((message_event.expires_at, notification))
    });

    let Some((expires_at, notification)) = received.flatten() else {
        return;
    };

    // The recipient's copy of the chat has its own time to live, so the message may expire at a
    // different time in each copy
    if let Some(expiry) = expires_at {
        state.handle_event_expiry(their_index, expiry);
    }

    if let Some(notification) = notification {
        state.push_notification(Some(sender), their_index, notification, now);
    }
}
