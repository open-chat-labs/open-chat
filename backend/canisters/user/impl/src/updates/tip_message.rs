use crate::crypto::process_transaction;
use crate::guards::caller_is_owner;
use crate::{RuntimeState, UserEventPusher, execute_update_async, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::TipMessageArgs;
use oc_error_codes::OCErrorCode;
use serde::Serialize;
use types::{Achievement, CanisterId, OCResult, TimestampNanos, UserId};
use user_canister::UserCanisterEvent;
use user_canister::tip_message::{Response::*, *};
use user_core::updates::tip_message::Prepared;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
async fn tip_message(args: Args) -> Response {
    execute_update_async(|| tip_message_impl(args)).await
}

async fn tip_message_impl(mut args: Args) -> Response {
    let (prepare_result, now_nanos) = match mutate_state(|state| prepare(&mut args, state)) {
        Ok(ok) => ok,
        Err(response) => return Error(response),
    };

    let pending_transfer = user_core::updates::tip_message::pending_transfer(&args, now_nanos);

    // Make the crypto transfer
    match process_transaction(pending_transfer).await {
        Ok(Ok(_)) => {}
        Ok(Err((_, error))) => return Error(error),
        Err(error) => return Error(error.into()),
    }

    mutate_state(|state| state.award_achievement_and_notify(Achievement::TippedMessage, state.env.now()));

    match prepare_result {
        Prepared::Direct(tip_message_args) => {
            mutate_state(|state| tip_direct_chat_message(tip_message_args, args.decimals, state))
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

fn prepare(args: &mut Args, state: &mut RuntimeState) -> OCResult<(Prepared, TimestampNanos)> {
    let my_user_id: UserId = state.env.canister_id().into();
    let now = state.env.now();
    user_core::updates::tip_message::prepare(&mut state.data.user, my_user_id, args, now)
}

fn tip_direct_chat_message(args: TipMessageArgs, decimals: u8, state: &mut RuntimeState) -> Response {
    if let Some(chat) = state.data.user.direct_chats.get_mut(&args.recipient.into()) {
        if let Err(error) = chat.tip_message(
            args.clone(),
            Some(UserEventPusher {
                now: args.now,
                rng: state.env.rng(),
                queue: &mut state.data.local_user_index_event_sync_queue,
            }),
        ) {
            Error(error)
        } else {
            let thread_root_message_id = match chat.thread_root_message_id(args.thread_root_message_index) {
                Ok(id) => id,
                Err(error) => return Error(error),
            };

            state.push_user_canister_event(
                args.recipient,
                UserCanisterEvent::TipMessage(Box::new(user_canister::TipMessageArgs {
                    thread_root_message_id,
                    message_id: args.message_id,
                    ledger: args.ledger,
                    token_symbol: args.token_symbol,
                    amount: args.amount,
                    decimals,
                    username: state.data.user.username.value.clone(),
                    display_name: state.data.user.display_name.value.clone(),
                    user_avatar_id: state.data.user.avatar.id(),
                })),
            );
            Success
        }
    } else {
        Error(OCErrorCode::ChatNotFound.into())
    }
}

fn fire_and_forget_c2c_tip_message<P: Serialize>(canister_id: CanisterId, payload: &P, state: &mut RuntimeState) {
    state.data.fire_and_forget_handler.send(
        canister_id,
        "c2c_tip_message_msgpack".to_string(),
        msgpack::serialize_then_unwrap(payload),
    );
}
