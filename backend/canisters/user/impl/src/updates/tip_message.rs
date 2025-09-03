use crate::crypto::process_transaction;
use crate::guards::caller_is_owner;
use crate::{RuntimeState, UserEventPusher, execute_update_async, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::TipMessageArgs;
use constants::{MEMO_TIP, NANOS_PER_MILLISECOND};
use ic_principal::Principal;
use oc_error_codes::OCErrorCode;
use serde::Serialize;
use types::{
    Achievement, CanisterId, Chat, ChatId, CommunityId, EventIndex, OCResult, PendingCryptoTransaction, TimestampNanos, UserId,
    icrc1,
};
use user_canister::UserCanisterEvent;
use user_canister::tip_message::{Response::*, *};

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
async fn tip_message(args: Args) -> Response {
    execute_update_async(|| tip_message_impl(args)).await
}

async fn tip_message_impl(args: Args) -> Response {
    let (prepare_result, now_nanos) = match mutate_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return Error(response),
    };

    let pending_transfer = PendingCryptoTransaction::ICRC1(icrc1::PendingCryptoTransaction {
        ledger: args.ledger,
        token_symbol: args.token_symbol.clone(),
        amount: args.amount,
        to: Principal::from(args.recipient).into(),
        fee: args.fee,
        memo: Some(MEMO_TIP.to_vec().into()),
        created: now_nanos,
    });
    // Make the crypto transfer
    match process_transaction(pending_transfer).await {
        Ok(Ok(_)) => {}
        Ok(Err(failed)) => return Error(OCErrorCode::TransferFailed.with_message(failed.error_message())),
        Err(error) => return Error(error.into()),
    }

    mutate_state(|state| state.award_achievement_and_notify(Achievement::TippedMessage, state.env.now()));

    match prepare_result {
        PrepareResult::Direct(tip_message_args) => {
            mutate_state(|state| tip_direct_chat_message(tip_message_args, args.decimals, state))
        }
        PrepareResult::Group(group_id, c2c_args) => {
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
        PrepareResult::Channel(community_id, c2c_args) => {
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

enum PrepareResult {
    Direct(TipMessageArgs),
    Group(ChatId, group_canister::c2c_tip_message::Args),
    Channel(CommunityId, community_canister::c2c_tip_message::Args),
}

fn prepare(args: &Args, state: &mut RuntimeState) -> OCResult<(PrepareResult, TimestampNanos)> {
    let my_user_id: UserId = state.env.canister_id().into();
    state.data.verify_not_suspended()?;

    if args.amount == 0 {
        Err(OCErrorCode::TransferCannotBeZero.into())
    } else if my_user_id == args.recipient {
        Err(OCErrorCode::CannotTipSelf.into())
    } else {
        let now = state.env.now();
        let now_nanos = now * NANOS_PER_MILLISECOND;
        state.data.pin_number.verify(args.pin.as_deref(), now)?;

        match args.chat {
            Chat::Direct(chat_id) if state.data.direct_chats.exists(&chat_id) => Ok((
                PrepareResult::Direct(TipMessageArgs {
                    user_id: my_user_id,
                    recipient: args.recipient,
                    thread_root_message_index: args.thread_root_message_index,
                    message_id: args.message_id,
                    ledger: args.ledger,
                    token_symbol: args.token_symbol.clone(),
                    amount: args.amount,
                    now,
                }),
                now_nanos,
            )),
            Chat::Group(group_id) if state.data.group_chats.exists(&group_id) => Ok((
                PrepareResult::Group(
                    group_id,
                    group_canister::c2c_tip_message::Args {
                        recipient: args.recipient,
                        thread_root_message_index: args.thread_root_message_index,
                        message_id: args.message_id,
                        ledger: args.ledger,
                        token_symbol: args.token_symbol.clone(),
                        amount: args.amount,
                        decimals: args.decimals,
                        username: state.data.username.value.clone(),
                        display_name: state.data.display_name.value.clone(),
                    },
                ),
                now_nanos,
            )),
            Chat::Channel(community_id, channel_id) if state.data.communities.exists(&community_id) => Ok((
                PrepareResult::Channel(
                    community_id,
                    community_canister::c2c_tip_message::Args {
                        recipient: args.recipient,
                        channel_id,
                        thread_root_message_index: args.thread_root_message_index,
                        message_id: args.message_id,
                        ledger: args.ledger,
                        token_symbol: args.token_symbol.clone(),
                        amount: args.amount,
                        decimals: args.decimals,
                        username: state.data.username.value.clone(),
                        display_name: state.data.display_name.value.clone(),
                    },
                ),
                now_nanos,
            )),
            _ => Err(OCErrorCode::ChatNotFound.into()),
        }
    }
}

fn tip_direct_chat_message(args: TipMessageArgs, decimals: u8, state: &mut RuntimeState) -> Response {
    if let Some(chat) = state.data.direct_chats.get_mut(&args.recipient.into()) {
        if let Err(error) = chat.events.tip_message(
            args.clone(),
            EventIndex::default(),
            Some(UserEventPusher {
                now: args.now,
                rng: state.env.rng(),
                queue: &mut state.data.local_user_index_event_sync_queue,
            }),
        ) {
            Error(error)
        } else {
            let thread_root_message_id = args.thread_root_message_index.map(|i| chat.main_message_index_to_id(i));

            state.push_user_canister_event(
                args.recipient.into(),
                UserCanisterEvent::TipMessage(Box::new(user_canister::TipMessageArgs {
                    thread_root_message_id,
                    message_id: args.message_id,
                    ledger: args.ledger,
                    token_symbol: args.token_symbol,
                    amount: args.amount,
                    decimals,
                    username: state.data.username.value.clone(),
                    display_name: state.data.display_name.value.clone(),
                    user_avatar_id: state.data.avatar.value.as_ref().map(|a| a.id),
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
