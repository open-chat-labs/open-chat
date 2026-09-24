use crate::crypto::{process_transaction_without_caller_check, user_wallet};
use crate::guards::caller_is_owner;
use crate::{RuntimeState, UserEventPusher, execute_update_async, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::TipMessageArgs;
use constants::{MEMO_TIP, NANOS_PER_MILLISECOND};
use oc_error_codes::OCErrorCode;
use serde::Serialize;
use types::{
    Achievement, CanisterId, Chat, ChatId, CommunityId, OCResult, PendingCryptoTransaction, TimestampNanos, UserId, icrc1,
    icrc2,
};
use user_canister::UserCanisterEvent;
use user_canister::tip_message::{Response::*, *};

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

    let local_user_index_canister_id = read_state(|state| state.data.local_user_index_canister_id);
    let recipient_wallet: icrc1::Account = match user_wallet(args.recipient, local_user_index_canister_id).await {
        Ok(recipient) => recipient.into(),
        Err(error) => return Error(error),
    };

    let pending_transfer = match args.from_account {
        // The allowance is what authorises this - the ledger only lets us pull from an account which
        // has approved this canister as spender - so there is nothing for us to check here.
        Some(from) => PendingCryptoTransaction::ICRC2(icrc2::PendingCryptoTransaction {
            ledger: args.ledger,
            token_symbol: args.token_symbol.clone(),
            amount: args.amount,
            from,
            to: recipient_wallet,
            fee: args.fee,
            memo: Some(MEMO_TIP.to_vec().into()),
            created: now_nanos,
        }),
        None => PendingCryptoTransaction::ICRC1(icrc1::PendingCryptoTransaction {
            ledger: args.ledger,
            token_symbol: args.token_symbol.clone(),
            amount: args.amount,
            to: recipient_wallet,
            fee: args.fee,
            memo: Some(MEMO_TIP.to_vec().into()),
            created: now_nanos,
        }),
    };
    // Make the crypto transfer. The caller was checked by the guard, and isn't available once the
    // recipient's wallet has been looked up.
    match process_transaction_without_caller_check(pending_transfer).await {
        Ok(Ok(_)) => {}
        Ok(Err((_, error))) => return Error(error),
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

fn prepare(args: &mut Args, state: &mut RuntimeState) -> OCResult<(PrepareResult, TimestampNanos)> {
    let my_user_id: UserId = state.env.canister_id().into();
    let now = state.env.now();
    user_core::updates::tip_message::verify(&mut state.data.user, my_user_id, args, state.env.canister_id(), now)?;
    let now_nanos = now * NANOS_PER_MILLISECOND;

    match args.chat {
        Chat::Direct(_) => Ok((
            PrepareResult::Direct(user_core::updates::tip_message::direct_tip_args(
                &state.data.user,
                my_user_id,
                args,
                now,
            )?),
            now_nanos,
        )),
        Chat::Group(group_id) if state.data.user.group_chats.exists(&group_id) => Ok((
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
                    username: state.data.user.username.value.clone(),
                    display_name: state.data.user.display_name.value.clone(),
                },
            ),
            now_nanos,
        )),
        Chat::Channel(community_id, channel_id) if state.data.user.communities.exists(&community_id) => Ok((
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
                    username: state.data.user.username.value.clone(),
                    display_name: state.data.user.display_name.value.clone(),
                },
            ),
            now_nanos,
        )),
        _ => Err(OCErrorCode::ChatNotFound.into()),
    }
}

fn tip_direct_chat_message(args: TipMessageArgs, decimals: u8, state: &mut RuntimeState) -> Response {
    let recipient = args.recipient;
    let now = args.now;
    match user_core::updates::tip_message::tip_direct_chat_message(
        &mut state.data.user,
        args,
        decimals,
        &state.data.migrated_user_ids,
        Some(UserEventPusher {
            now,
            rng: state.env.rng(),
            queue: &mut state.data.local_user_index_event_sync_queue,
        }),
    ) {
        Ok(c2c_args) => {
            state.push_user_canister_event(recipient, UserCanisterEvent::TipMessage(Box::new(c2c_args)));
            Success
        }
        Err(error) => Error(error),
    }
}

fn fire_and_forget_c2c_tip_message<P: Serialize>(canister_id: CanisterId, payload: &P, state: &mut RuntimeState) {
    state.data.fire_and_forget_handler.send(
        canister_id,
        "c2c_tip_message_msgpack".to_string(),
        msgpack::serialize_then_unwrap(payload),
    );
}
