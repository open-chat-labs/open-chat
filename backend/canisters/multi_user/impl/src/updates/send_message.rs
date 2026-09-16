use crate::guards::caller_is_owner;
use crate::model::user_direct_chats::UserDirectChat;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::{
    MessageContentInternal, NullEventPusher, PushMessageArgs, ReplyContextInternal, ValidateNewMessageContentResult,
};
use constants::OPENCHAT_BOT_USER_ID;
use direct_chat_core::{DirectChatCore, Participant};
use oc_error_codes::OCErrorCode;
use rand::RngExt;
use types::{OCResult, TimestampMillis, UserId, UserType};
use user_canister::c2c_bot_send_message;
use user_canister::send_message_v2::{Response::*, *};

#[update(guard = "caller_is_owner", msgpack = true)]
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
            unimplemented!("Messages with transfers are not yet supported by the MultiUser canister")
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
        content,
        mentioned: Vec::new(),
        replies_to: args.replies_to.as_ref().map(ReplyContextInternal::from),
        forwarded: args.forwarding,
        sender_is_bot: false,
        block_level_markdown: args.block_level_markdown,
        og_previews: args.og_previews,
        now,
        sender_context: None,
    };

    let chat_id = args.recipient.into();
    let chat_exists = state
        .data
        .users
        .with_user(my_index, |user| user.direct_chats.get(&chat_id).is_some())
        == Some(true);
    if !chat_exists {
        create_direct_chat(my_index, my_user_id, recipient, now, state);
    }

    // TODO: Push the message to the event store (`UserEventPusher` in the User canister)
    let message_event = match state.with_direct_chat_mut(my_index, chat_id, |mut chat| {
        chat.push_message::<NullEventPusher>(push_message_args, None, None)
    }) {
        Ok(event) => event,
        Err(error) => return Error(error),
    };

    // TODO: Notify the recipient, award achievements and register the timer jobs for message
    // expiry, as the User canister does

    Success(SuccessResult {
        chat_id,
        event_index: message_event.index,
        message_index: message_event.event.message_index,
        timestamp: now,
        expires_at: message_event.expires_at,
    })
}

// Who a message is to, relative to its sender
#[derive(Clone, Copy)]
enum Recipient {
    // The sender's chat with themselves
    Me,
    // Another user in this canister, whose entry for the chat shares the sender's core
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

    // TODO: Reject recipients the sender has blocked once blocked users are held per user
    if args.recipient == OPENCHAT_BOT_USER_ID {
        return Err(OCErrorCode::InvalidRequest.with_message("Messaging the OpenChat Bot is not currently supported"));
    }

    let recipient = if args.recipient == my_user_id {
        Recipient::Me
    } else if let Some(index) = state
        .user_index(args.recipient)
        .filter(|index| state.data.users.contains(*index))
    {
        Recipient::SameCanister(index)
    } else {
        // TODO: Users in other canisters, including bots, need the recipient looked up in the
        // LocalUserIndex when there is no chat with them yet, and the message sent on to their
        // canister
        unimplemented!("Sending messages to users in other canisters is not yet supported by the MultiUser canister")
    };

    let cores = &state.data.direct_chat_cores;
    state.with_user(my_user_id, |user| -> OCResult<()> {
        user.verify_not_suspended()?;

        if let Some(chat) = user.direct_chats.get(&args.recipient.into())
            && cores.with_chat(chat, |chat| {
                chat.events()
                    .message_already_finalised(args.thread_root_message_index, args.message_id, false)
            })
        {
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

// Creates the sender's entry for the chat with `recipient`, and its core. When the recipient is in
// this canister the two users share one core: if the recipient already has an entry for the chat
// (because the sender deleted their side of it) the sender takes the other position in that core,
// otherwise a new core is created with an entry for each of them.
fn create_direct_chat(my_index: u16, my_user_id: UserId, recipient: Recipient, now: TimestampMillis, state: &mut RuntimeState) {
    let anonymized_id: u128 = state.env.rng().random();
    let cores = &mut state.data.direct_chat_cores;
    let users = &mut state.data.users;

    match recipient {
        Recipient::Me => {
            let key_id = cores.add(|key_id| DirectChatCore::new(my_user_id, my_user_id, key_id, None, anonymized_id, now));
            users.with_user_mut(my_index, |user| {
                user.direct_chats.add(UserDirectChat::new(
                    key_id,
                    Participant::First,
                    my_user_id,
                    UserType::User,
                    now,
                ))
            });
        }
        Recipient::SameCanister(their_index) => {
            let them = UserId::new_indexed(my_user_id.canister_id(), their_index);
            let their_entry = users
                .with_user(their_index, |user| {
                    user.direct_chats.get(&my_user_id.into()).map(|chat| (chat.key_id, chat.me))
                })
                .flatten();

            let (key_id, me) = match their_entry {
                Some((key_id, their_position)) => (key_id, their_position.other()),
                None => {
                    let key_id = cores.add(|key_id| DirectChatCore::new_shared(them, key_id, None, anonymized_id, now));
                    users.with_user_mut(their_index, |user| {
                        user.direct_chats.add(UserDirectChat::new(
                            key_id,
                            Participant::Second,
                            my_user_id,
                            UserType::User,
                            now,
                        ))
                    });
                    (key_id, Participant::First)
                }
            };

            users.with_user_mut(my_index, |user| {
                user.direct_chats
                    .add(UserDirectChat::new(key_id, me, them, UserType::User, now))
            });
        }
    }
}
