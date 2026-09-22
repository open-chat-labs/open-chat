use crate::crypto::{release_transfer, use_transfer, verify_recipient, wallet_account};
use crate::guards::caller_is_hosted_user;
use crate::timer_job_types::{TipMessageInChannelJob, TipMessageInGroupJob};
use crate::{RuntimeState, mutate_state, read_state};
use candid::Principal;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::{NullEventPusher, TipMessageArgs};
use oc_error_codes::OCErrorCode;
use types::{Achievement, Chat, ChatId, CommunityId, OCResult, PendingCryptoTransaction, TimestampMillis, UserId, icrc1};
use user_canister::UserCanisterEvent;
use user_canister::tip_message::{Response::*, *};

// The user has already made the transfer to the wallet of the message's sender, so it is verified
// and then the tip is recorded in the chat
#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
async fn tip_message(args: Args) -> Response {
    let PrepareOk {
        my_index,
        my_user_id,
        my_principal,
        transfer,
        chat,
    } = match read_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(error) => return Error(error),
    };

    match wallet_account(args.recipient).await {
        Ok(wallet) => {
            if let Err(error) = verify_recipient(&transfer, wallet) {
                return Error(error);
            }
        }
        Err(error) => return Error(error),
    }

    match chat {
        TipChat::Direct(chat_id) => mutate_state(|state| {
            let completed = match use_transfer(transfer, my_principal, state) {
                Ok(completed) => completed,
                Err(error) => return Error(error),
            };
            match tip_direct_chat_message(my_index, my_user_id, chat_id, &args, state) {
                Ok(()) => {
                    state.award_achievement_and_notify(my_index, Achievement::TippedMessage, state.env.now());
                    Success
                }
                Err(error) => {
                    release_transfer(&completed, state);
                    Error(error)
                }
            }
        }),
        TipChat::Group(group_id, username, display_name) => {
            let completed = match mutate_state(|state| use_transfer(transfer, my_principal, state)) {
                Ok(completed) => completed,
                Err(error) => return Error(error),
            };
            let c2c_args = group_canister::c2c_tip_message::Args {
                recipient: args.recipient,
                thread_root_message_index: args.thread_root_message_index,
                message_id: args.message_id,
                ledger: args.ledger,
                token_symbol: args.token_symbol.clone(),
                amount: args.amount,
                decimals: args.decimals,
                username,
                display_name,
                user_id: Some(my_user_id),
            };
            use group_canister::c2c_tip_message::Response;
            match group_canister_c2c_client::c2c_tip_message(group_id.into(), &c2c_args).await {
                Ok(Response::Success) => tipped(my_index),
                Ok(Response::Error(error)) => not_tipped(&completed, error),
                // The tip has been transferred, so the call is retried until it is recorded
                Err(error) => {
                    TipMessageInGroupJob {
                        user_index: my_index,
                        chat_id: group_id,
                        args: c2c_args,
                        attempt: 0,
                    }
                    .enqueue();
                    tipped(my_index);
                    Retrying(format!("{error:?}"))
                }
            }
        }
        TipChat::Channel(community_id, channel_id, username, display_name) => {
            let completed = match mutate_state(|state| use_transfer(transfer, my_principal, state)) {
                Ok(completed) => completed,
                Err(error) => return Error(error),
            };
            let c2c_args = community_canister::c2c_tip_message::Args {
                recipient: args.recipient,
                channel_id,
                thread_root_message_index: args.thread_root_message_index,
                message_id: args.message_id,
                ledger: args.ledger,
                token_symbol: args.token_symbol.clone(),
                amount: args.amount,
                decimals: args.decimals,
                username,
                display_name,
                user_id: Some(my_user_id),
            };
            use community_canister::c2c_tip_message::Response;
            match community_canister_c2c_client::c2c_tip_message(community_id.into(), &c2c_args).await {
                Ok(Response::Success) => tipped(my_index),
                Ok(Response::Error(error)) => not_tipped(&completed, error),
                // The tip has been transferred, so the call is retried until it is recorded
                Err(error) => {
                    TipMessageInChannelJob {
                        user_index: my_index,
                        community_id,
                        args: c2c_args,
                        attempt: 0,
                    }
                    .enqueue();
                    tipped(my_index);
                    Retrying(format!("{error:?}"))
                }
            }
        }
    }
}

fn tipped(my_index: u16) -> Response {
    mutate_state(|state| state.award_achievement_and_notify(my_index, Achievement::TippedMessage, state.env.now()));
    Success
}

// The chat refused the tip, so the transfer is freed to be used again
fn not_tipped(transfer: &icrc1::CompletedCryptoTransaction, error: oc_error_codes::OCError) -> Response {
    mutate_state(|state| release_transfer(transfer, state));
    Error(error)
}

struct PrepareOk {
    my_index: u16,
    my_user_id: UserId,
    // Taken now since the caller isn't available once the endpoint has awaited a call
    my_principal: Principal,
    transfer: PendingCryptoTransaction,
    chat: TipChat,
}

enum TipChat {
    Direct(ChatId),
    // With the tipper's username and display name
    Group(ChatId, String, Option<String>),
    Channel(CommunityId, types::ChannelId, String, Option<String>),
}

fn prepare(args: &Args, state: &RuntimeState) -> OCResult<PrepareOk> {
    state.with_caller_user(|my_index, user| {
        let my_user_id = state.user_id(my_index);
        user.verify_not_suspended()?;

        if args.amount == 0 {
            return Err(OCErrorCode::TransferCannotBeZero.into());
        }
        if args.recipient == my_user_id {
            return Err(OCErrorCode::CannotTipSelf.into());
        }

        let Some(transfer) = args.transfer.clone() else {
            return Err(OCErrorCode::InvalidRequest.with_message("The transfer the user has made must be given"));
        };
        if transfer.ledger_canister_id() != args.ledger
            || transfer.token_symbol() != args.token_symbol
            || transfer.units() != args.amount
        {
            return Err(OCErrorCode::InvalidRequest.with_message("Transfer does not match the tip"));
        }

        let username = || user.username.value.clone();
        let display_name = || user.display_name.value.clone();
        let chat = match args.chat {
            // Only the other user's messages can be tipped
            Chat::Direct(chat_id) if chat_id == args.recipient.into() && user.direct_chats.exists(&chat_id) => {
                TipChat::Direct(chat_id)
            }
            Chat::Group(group_id) if user.group_chats.exists(&group_id) => TipChat::Group(group_id, username(), display_name()),
            Chat::Channel(community_id, channel_id) if user.communities.exists(&community_id) => {
                TipChat::Channel(community_id, channel_id, username(), display_name())
            }
            _ => return Err(OCErrorCode::ChatNotFound.into()),
        };

        Ok(PrepareOk {
            my_index,
            my_user_id,
            my_principal: user.principal,
            transfer,
            chat,
        })
    })
}

// Records the tip in the tipper's copy of the chat, then in the other user's copy: directly if they
// are in this canister, otherwise by sending it to their canister
fn tip_direct_chat_message(
    my_index: u16,
    my_user_id: UserId,
    chat_id: ChatId,
    args: &Args,
    state: &mut RuntimeState,
) -> OCResult {
    let now = state.env.now();
    let tip_message_args = TipMessageArgs {
        user_id: my_user_id,
        recipient: args.recipient,
        thread_root_message_index: args.thread_root_message_index,
        message_id: args.message_id,
        ledger: args.ledger,
        token_symbol: args.token_symbol.clone(),
        amount: args.amount,
        now,
    };

    let (thread_root_message_id, username, display_name, user_avatar_id) = state
        .data
        .users
        .with_user_mut(my_index, |user| -> OCResult<_> {
            let chat = user.direct_chats.get_mut_or_err(&chat_id)?;
            chat.tip_message::<NullEventPusher>(tip_message_args, None)?;
            let thread_root_message_id = chat.thread_root_message_id(args.thread_root_message_index)?;
            Ok((
                thread_root_message_id,
                user.username.value.clone(),
                user.display_name.value.clone(),
                user.avatar.id(),
            ))
        })
        .ok_or(OCErrorCode::InitiatorNotFound)??;

    let c2c_args = user_canister::TipMessageArgs {
        thread_root_message_id,
        message_id: args.message_id,
        ledger: args.ledger,
        token_symbol: args.token_symbol.clone(),
        amount: args.amount,
        decimals: args.decimals,
        username,
        display_name,
        user_avatar_id,
    };

    if let Some(their_index) = state.index_of_local_user(args.recipient) {
        receive_tip(their_index, my_user_id, c2c_args, now, state);
    } else {
        state.push_user_canister_event(my_index, args.recipient, UserCanisterEvent::TipMessage(Box::new(c2c_args)));
    }
    Ok(())
}

// Records a tip from `sender` in the copy of their chat held by the user at `recipient_index`, as
// the User canister does when sent a tip, along with the recipient's notification, message activity
// and achievement
pub(crate) fn receive_tip(
    recipient_index: u16,
    sender: UserId,
    args: user_canister::TipMessageArgs,
    now: TimestampMillis,
    state: &mut RuntimeState,
) {
    let recipient = state.user_id(recipient_index);
    let Some(tipped) = state
        .with_their_direct_chat_mut(sender, recipient, |chat| {
            user_core::updates::c2c_user_canister::tip_message(chat, sender, recipient, args, now)
        })
        .flatten()
    else {
        return;
    };

    let suspended = state
        .data
        .users
        .with_user_mut(recipient_index, |user| {
            user.push_message_activity(tipped.activity, now);
            user.suspended.value
        })
        .unwrap_or_default();
    if !suspended {
        state.push_notification(Some(sender), recipient_index, tipped.notification, now);
    }
    state.award_achievement_and_notify(recipient_index, Achievement::HadMessageTipped, now);
}
