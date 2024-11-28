use crate::crypto::process_transaction;
use crate::guards::caller_is_owner;
use crate::model::pin_number::VerifyPinError;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use candid::Principal;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::{TipMessageArgs, TipMessageResult};
use constants::{MEMO_TIP, NANOS_PER_MILLISECOND};
use serde::Serialize;
use types::{
    icrc1, Achievement, CanisterId, Chat, ChatId, CommunityId, EventIndex, PendingCryptoTransaction, TimestampNanos, UserId,
};
use user_canister::tip_message::{Response::*, *};
use user_canister::UserCanisterEvent;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
async fn tip_message(args: Args) -> Response {
    run_regular_jobs();

    let (prepare_result, now_nanos) = match mutate_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return *response,
    };

    let pending_transfer = PendingCryptoTransaction::ICRC1(icrc1::PendingCryptoTransaction {
        ledger: args.ledger,
        token: args.token.clone(),
        amount: args.amount,
        to: Principal::from(args.recipient).into(),
        fee: args.fee,
        memo: Some(MEMO_TIP.to_vec().into()),
        created: now_nanos,
    });
    // Make the crypto transfer
    match process_transaction(pending_transfer).await {
        Ok(Ok(_)) => {}
        Ok(Err(failed)) => return TransferFailed(failed.error_message().to_string()),
        Err(error) => return InternalError(format!("{error:?}")),
    }

    mutate_state(|state| {
        state
            .data
            .award_achievement_and_notify(Achievement::TippedMessage, state.env.now())
    });

    match prepare_result {
        PrepareResult::Direct(tip_message_args) => {
            mutate_state(|state| tip_direct_chat_message(tip_message_args, args.decimals, state))
        }
        PrepareResult::Group(group_id, c2c_args) => {
            use group_canister::c2c_tip_message::Response;
            match group_canister_c2c_client::c2c_tip_message(group_id.into(), &c2c_args).await {
                Ok(Response::Success) => Success,
                Ok(Response::MessageNotFound) => MessageNotFound,
                Ok(Response::CannotTipSelf) => CannotTipSelf,
                Ok(Response::RecipientMismatch) => TransferNotToMessageSender,
                Ok(Response::NotAuthorized) => NotAuthorized,
                Ok(Response::GroupFrozen) => ChatFrozen,
                Ok(Response::UserNotInGroup) => ChatNotFound,
                Ok(Response::UserSuspended) => UserSuspended,
                Ok(Response::UserLapsed) => UserLapsed,
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
                Ok(Response::MessageNotFound) => MessageNotFound,
                Ok(Response::CannotTipSelf) => CannotTipSelf,
                Ok(Response::RecipientMismatch) => TransferNotToMessageSender,
                Ok(Response::NotAuthorized) => NotAuthorized,
                Ok(Response::CommunityFrozen) => ChatFrozen,
                Ok(Response::UserSuspended) => UserSuspended,
                Ok(Response::UserLapsed) => UserLapsed,
                Ok(Response::UserNotInCommunity | Response::ChannelNotFound) => ChatNotFound,
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

fn prepare(args: &Args, state: &mut RuntimeState) -> Result<(PrepareResult, TimestampNanos), Box<Response>> {
    let my_user_id: UserId = state.env.canister_id().into();
    if state.data.suspended.value {
        Err(Box::new(UserSuspended))
    } else if args.amount == 0 {
        Err(Box::new(TransferCannotBeZero))
    } else if my_user_id == args.recipient {
        Err(Box::new(CannotTipSelf))
    } else {
        let now = state.env.now();
        let now_nanos = now * NANOS_PER_MILLISECOND;

        if let Err(error) = state.data.pin_number.verify(args.pin.as_deref(), now) {
            return Err(Box::new(match error {
                VerifyPinError::PinRequired => PinRequired,
                VerifyPinError::PinIncorrect(delay) => PinIncorrect(delay),
                VerifyPinError::TooManyFailedAttempted(delay) => TooManyFailedPinAttempts(delay),
            }));
        }

        match args.chat {
            Chat::Direct(chat_id) if state.data.direct_chats.exists(&chat_id) => Ok((
                PrepareResult::Direct(TipMessageArgs {
                    user_id: my_user_id,
                    recipient: args.recipient,
                    thread_root_message_index: args.thread_root_message_index,
                    message_id: args.message_id,
                    ledger: args.ledger,
                    token: args.token.clone(),
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
                        token: args.token.clone(),
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
                        token: args.token.clone(),
                        amount: args.amount,
                        decimals: args.decimals,
                        username: state.data.username.value.clone(),
                        display_name: state.data.display_name.value.clone(),
                    },
                ),
                now_nanos,
            )),
            _ => Err(Box::new(ChatNotFound)),
        }
    }
}

fn tip_direct_chat_message(args: TipMessageArgs, decimals: u8, state: &mut RuntimeState) -> Response {
    if let Some(chat) = state.data.direct_chats.get_mut(&args.recipient.into()) {
        match chat
            .events
            .tip_message(args.clone(), EventIndex::default(), Some(&mut state.data.event_store_client))
        {
            TipMessageResult::Success => {
                let thread_root_message_id = args.thread_root_message_index.map(|i| chat.main_message_index_to_id(i));

                state.push_user_canister_event(
                    args.recipient.into(),
                    UserCanisterEvent::TipMessage(Box::new(user_canister::TipMessageArgs {
                        thread_root_message_id,
                        message_id: args.message_id,
                        ledger: args.ledger,
                        token: args.token,
                        amount: args.amount,
                        decimals,
                        username: state.data.username.value.clone(),
                        display_name: state.data.display_name.value.clone(),
                        user_avatar_id: state.data.avatar.value.as_ref().map(|a| a.id),
                    })),
                );
                Success
            }
            TipMessageResult::MessageNotFound => MessageNotFound,
            TipMessageResult::CannotTipSelf => CannotTipSelf,
            TipMessageResult::RecipientMismatch => TransferNotToMessageSender,
        }
    } else {
        ChatNotFound
    }
}

fn fire_and_forget_c2c_tip_message<P: Serialize>(canister_id: CanisterId, payload: &P, state: &mut RuntimeState) {
    state.data.fire_and_forget_handler.send(
        canister_id,
        "c2c_tip_message_msgpack".to_string(),
        msgpack::serialize_then_unwrap(payload),
    );
}
