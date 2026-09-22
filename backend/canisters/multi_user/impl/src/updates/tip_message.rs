use crate::crypto::process_transaction;
use crate::guards::caller_is_hosted_user;
use crate::updates::c2c_user_canister_v2::receive_tip;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::{NullEventPusher, TipMessageArgs};
use oc_error_codes::OCErrorCode;
use serde::Serialize;
use types::{Achievement, CanisterId, OCResult, TimestampNanos, UserId};
use user_canister::UserCanisterEvent;
use user_canister::tip_message::{Response::*, *};
use user_core::updates::tip_message::Prepared;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
async fn tip_message(args: Args) -> Response {
    tip_message_impl(args).await
}

// As in the User canister, the tip is paid from the user's account (one of this canister's
// subaccounts) or the account they approved, then applied to the message
async fn tip_message_impl(mut args: Args) -> Response {
    let PrepareOk {
        my_index,
        my_user_id,
        prepared,
        now_nanos,
    } = match mutate_state(|state| prepare(&mut args, state)) {
        Ok(ok) => ok,
        Err(error) => return Error(error),
    };

    let pending_transfer = user_core::updates::tip_message::pending_transfer(&args, now_nanos);
    match process_transaction(pending_transfer, my_user_id).await {
        Ok(Ok(_)) => {}
        Ok(Err((_, error))) => return Error(error),
        Err(error) => return Error(error.into()),
    }

    mutate_state(|state| state.award_achievement_and_notify(my_index, Achievement::TippedMessage, state.env.now()));

    match prepared {
        Prepared::Direct(tip_message_args) => {
            mutate_state(|state| tip_direct_chat_message(my_index, tip_message_args, args.decimals, state))
        }
        Prepared::Group(group_id, c2c_args) => {
            use group_canister::c2c_tip_message::Response;
            match group_canister_c2c_client::c2c_tip_message(group_id.into(), &c2c_args).await {
                Ok(Response::Success) => Success,
                Ok(Response::Error(error)) => Error(error),
                Err(error) => {
                    mutate_state(|state| fire_and_forget_c2c_tip_message(group_id.into(), &c2c_args, state));
                    Retrying(format!("{error:?}"))
                }
            }
        }
        Prepared::Channel(community_id, c2c_args) => {
            use community_canister::c2c_tip_message::Response;
            match community_canister_c2c_client::c2c_tip_message(community_id.into(), &c2c_args).await {
                Ok(Response::Success) => Success,
                Ok(Response::Error(error)) => Error(error),
                Err(error) => {
                    mutate_state(|state| fire_and_forget_c2c_tip_message(community_id.into(), &c2c_args, state));
                    Retrying(format!("{error:?}"))
                }
            }
        }
    }
}

struct PrepareOk {
    my_index: u16,
    my_user_id: UserId,
    prepared: Prepared,
    now_nanos: TimestampNanos,
}

fn prepare(args: &mut Args, state: &mut RuntimeState) -> OCResult<PrepareOk> {
    let canister_id = state.env.canister_id();
    let now = state.env.now();
    state.with_caller_user_mut(|my_index, user| {
        let my_user_id = UserId::new_indexed(canister_id, my_index);
        let (prepared, now_nanos) = user_core::updates::tip_message::prepare(user, my_user_id, args, now)?;
        Ok(PrepareOk {
            my_index,
            my_user_id,
            prepared,
            now_nanos,
        })
    })
}

// Applies the tip to the tipper's copy of the chat, then to the recipient's: directly if they are in
// this canister, else via their canister as the User canister does
fn tip_direct_chat_message(my_index: u16, args: TipMessageArgs, decimals: u8, state: &mut RuntimeState) -> Response {
    let my_user_id = state.user_id(my_index);
    let recipient = args.recipient;
    let applied = state.data.users.with_user_mut(my_index, |user| -> OCResult<_> {
        let chat = user
            .direct_chats
            .get_mut(&recipient.into())
            .ok_or(OCErrorCode::ChatNotFound)?;
        // TODO: Push the tip to the event store (`UserEventPusher` in the User canister)
        chat.tip_message::<NullEventPusher>(args.clone(), None)?;
        let thread_root_message_id = chat.thread_root_message_id(args.thread_root_message_index)?;
        Ok(user_canister::TipMessageArgs {
            thread_root_message_id,
            message_id: args.message_id,
            ledger: args.ledger,
            token_symbol: args.token_symbol,
            amount: args.amount,
            decimals,
            username: user.username.value.clone(),
            display_name: user.display_name.value.clone(),
            user_avatar_id: user.avatar.id(),
        })
    });
    let c2c_args = match applied {
        Some(Ok(c2c_args)) => c2c_args,
        Some(Err(error)) => return Error(error),
        // The tipper was deleted while the transfer was being made
        None => return Error(OCErrorCode::InitiatorNotFound.into()),
    };

    if let Some(their_index) = state.index_of_local_user(recipient) {
        let now = state.env.now();
        receive_tip(c2c_args, my_user_id, recipient, their_index, now, state);
    } else {
        state.push_user_canister_event(my_index, recipient, UserCanisterEvent::TipMessage(Box::new(c2c_args)));
    }
    Success
}

fn fire_and_forget_c2c_tip_message<P: Serialize>(canister_id: CanisterId, payload: &P, state: &mut RuntimeState) {
    state.data.fire_and_forget_handler.send(
        canister_id,
        "c2c_tip_message_msgpack".to_string(),
        msgpack::serialize_then_unwrap(payload),
    );
}
