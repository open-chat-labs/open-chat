use crate::{RuntimeState, RUNTIME_STATE};
use chat_events::{PushMessageArgs, ReplyContextInternal};
use cycles_utils::check_cycles_balance;
use ic_cdk_macros::update;
use std::collections::hash_map::Entry::{Occupied, Vacant};
use types::{CanisterId, ChatId, EventIndex, Message, MessageIndex, UserId};
use user_canister::c2c_send_message;
use user_canister::send_message::{Response::*, *};

#[update]
fn send_message(args: Args) -> Response {
    check_cycles_balance();

    RUNTIME_STATE.with(|state| send_message_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn send_message_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    runtime_state.trap_if_caller_not_owner();

    if runtime_state.data.blocked_users.contains(&args.recipient) {
        return RecipientBlocked;
    }

    let my_user_id = runtime_state.env.canister_id().into();

    let now = runtime_state.env.now();
    let push_message_args = PushMessageArgs {
        message_id: args.message_id,
        sender: my_user_id,
        content: args.content.clone(),
        replies_to: args.replies_to.as_ref().map(|r| match r {
            ReplyContextArgs::Direct(d) => ReplyContextInternal::SameChat(d.message_id),
            ReplyContextArgs::Private(p) => ReplyContextInternal::OtherChat(Box::new(p.clone())),
        }),
        now,
    };

    let (chat_id, event_index, message) = handle_push_message(true, args.recipient, push_message_args, runtime_state);

    let (canister_id, c2c_args) = build_c2c_args(args, message.message_index);
    ic_cdk::block_on(send_to_recipients_canister(canister_id, c2c_args));

    Success(SuccessResult {
        chat_id,
        event_index,
        message_index: message.message_index,
        timestamp: now,
    })
}

pub(crate) fn handle_push_message(
    sent_by_me: bool,
    their_user_id: UserId,
    args: PushMessageArgs,
    runtime_state: &mut RuntimeState,
) -> (ChatId, EventIndex, Message) {
    let now = args.now;
    let maybe_replies_to = args.replies_to.clone();

    let (chat_id, event_index, message) = runtime_state
        .data
        .direct_chats
        .push_message(sent_by_me, their_user_id, None, args);

    if let Some(chat) = runtime_state.data.direct_chats.get_mut(&chat_id) {
        if let Some((users_to_mark_as_read, _)) = chat.message_ids_read_but_not_confirmed.remove(&message.message_id) {
            for is_me in users_to_mark_as_read.into_iter() {
                if is_me {
                    chat.read_by_me.insert(message.message_index.into());
                    chat.read_by_me_updated = now;
                } else {
                    chat.read_by_them.insert(message.message_index.into());
                    chat.read_by_them_updated = now;
                }
            }
        }

        if let Some(replies_to) = maybe_replies_to {
            match replies_to {
                // If the new message replies to a message in this same chat, add the pair of
                // message Ids to the 'replies_map'
                ReplyContextInternal::SameChat(message_id) => match chat.replies_map.entry(message_id) {
                    Occupied(e) => e.into_mut().push(message.message_id),
                    Vacant(e) => {
                        e.insert(vec![message.message_id]);
                    }
                },
                ReplyContextInternal::OtherChat(_) => {
                    // TODO mark the reply on the chat canister of the message being replied to
                }
            }
        }
    }

    (chat_id, event_index, message)
}

fn build_c2c_args(args: Args, message_index: MessageIndex) -> (CanisterId, c2c_send_message::Args) {
    let c2c_args = c2c_send_message::Args {
        message_id: args.message_id,
        sender_name: args.sender_name,
        sender_message_index: message_index,
        content: args.content,
        replies_to: args.replies_to,
    };

    (args.recipient.into(), c2c_args)
}

async fn send_to_recipients_canister(canister_id: CanisterId, args: c2c_send_message::Args) {
    // Note: We ignore any Block response - it means the sender won't know they're blocked
    // but maybe that is not so bad. Otherwise we would have to wait for the call to the
    // recipient canister which would double the latency of every message.
    let _ = user_canister_c2c_client::c2c_send_message(canister_id, &args).await;
}
