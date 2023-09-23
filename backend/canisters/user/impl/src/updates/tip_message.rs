use crate::crypto::process_transaction;
use crate::guards::caller_is_owner;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use candid::Principal;
use canister_tracing_macros::trace;
use chat_events::{TipMessageArgs, TipMessageResult};
use ic_cdk_macros::update;
use types::{icrc1, Chat, ChatId, CommunityId, EventIndex, PendingCryptoTransaction, TimestampNanos, UserId};
use user_canister::tip_message::{Response::*, *};

#[update(guard = "caller_is_owner")]
#[trace]
async fn tip_message(args: Args) -> Response {
    run_regular_jobs();

    let (prepare_result, now_nanos) = match read_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return *response,
    };

    let pending_transfer = PendingCryptoTransaction::ICRC1(icrc1::PendingCryptoTransaction {
        ledger: args.ledger,
        token: args.token.clone(),
        amount: args.amount,
        to: Principal::from(args.recipient).into(),
        fee: args.fee,
        memo: None,
        created: now_nanos,
    });
    // Make the crypto transfer
    let completed_transfer = match process_transaction(pending_transfer).await {
        Ok(transfer) => transfer,
        Err(failed) => return TransferFailed(failed.error_message().to_string()),
    };

    match prepare_result {
        PrepareResult::Direct(tip_message_args) => mutate_state(|state| tip_direct_chat_message(tip_message_args, state)),
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
                Err(error) => InternalError(format!("{error:?}"), Box::new(completed_transfer)),
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
                Ok(Response::UserNotInCommunity | Response::ChannelNotFound) => ChatNotFound,
                Err(error) => InternalError(format!("{error:?}"), Box::new(completed_transfer)),
            }
        }
    }
}

enum PrepareResult {
    Direct(TipMessageArgs),
    Group(ChatId, group_canister::c2c_tip_message::Args),
    Channel(CommunityId, community_canister::c2c_tip_message::Args),
}

fn prepare(args: &Args, state: &RuntimeState) -> Result<(PrepareResult, TimestampNanos), Box<Response>> {
    let my_user_id: UserId = state.env.canister_id().into();
    if state.data.suspended.value {
        Err(Box::new(UserSuspended))
    } else if args.amount == 0 {
        Err(Box::new(TransferCannotBeZero))
    } else if my_user_id == args.recipient {
        Err(Box::new(CannotTipSelf))
    } else {
        let now_nanos = state.env.now_nanos();
        match args.chat {
            Chat::Direct(chat_id) if state.data.direct_chats.has(&chat_id) => Ok((
                PrepareResult::Direct(TipMessageArgs {
                    user_id: my_user_id,
                    recipient: args.recipient,
                    thread_root_message_index: args.thread_root_message_index,
                    message_id: args.message_id,
                    ledger: args.ledger,
                    token: args.token.clone(),
                    amount: args.amount,
                    now: state.env.now(),
                }),
                now_nanos,
            )),
            Chat::Group(group_id) if state.data.group_chats.has(&group_id) => Ok((
                PrepareResult::Group(
                    group_id,
                    group_canister::c2c_tip_message::Args {
                        recipient: args.recipient,
                        thread_root_message_index: args.thread_root_message_index,
                        message_id: args.message_id,
                        ledger: args.ledger,
                        token: args.token.clone(),
                        amount: args.amount,
                        username: state.data.username.value.clone(),
                        display_name: state.data.display_name.value.clone(),
                    },
                ),
                now_nanos,
            )),
            Chat::Channel(community_id, channel_id) if state.data.communities.has(&community_id) => Ok((
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

fn tip_direct_chat_message(args: TipMessageArgs, state: &mut RuntimeState) -> Response {
    if let Some(chat) = state.data.direct_chats.get_mut(&args.recipient.into()) {
        match chat.events.tip_message(args.clone(), EventIndex::default()) {
            TipMessageResult::Success => {
                let c2c_args = user_canister::c2c_tip_message::Args {
                    thread_root_message_index: args.thread_root_message_index,
                    message_id: args.message_id,
                    ledger: args.ledger,
                    token: args.token,
                    amount: args.amount,
                    username: state.data.username.value.clone(),
                    display_name: state.data.display_name.value.clone(),
                    user_avatar_id: state.data.avatar.value.as_ref().map(|a| a.id),
                };
                state.data.fire_and_forget_handler.send(
                    args.recipient.into(),
                    "c2c_tip_message_msgpack".to_string(),
                    msgpack::serialize_then_unwrap(c2c_args),
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
