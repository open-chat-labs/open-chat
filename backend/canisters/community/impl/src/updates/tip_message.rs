use crate::activity_notifications::handle_activity_notification;
use crate::{CommunityEventPusher, RuntimeState, execute_update_async, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::TipMessageArgs;
use community_canister::tip_message::*;
use constants::MEMO_TIP;
use ledger_utils::{TransferRecipient, UserTransfer, format_crypto_amount_with_symbol};
use multi_user_canister::{CommunityCanisterEvent, MessageActivity, MessageActivityEvent};
use oc_error_codes::OCErrorCode;
use types::{
    Achievement, Caller, CanisterId, ChannelId, ChannelMessageTipped, ChannelUserNotificationPayload, Chat, CryptoTransaction,
    EventIndex, MessageId, MessageIndex, OCResult, UserId, icrc2,
};

#[update(msgpack = true)]
#[trace]
async fn tip_message(args: Args) -> Response {
    execute_update_async(|| tip_message_impl(args)).await.into()
}

async fn tip_message_impl(args: Args) -> OCResult {
    let new_achievement = args.new_achievement;

    let user_id = match mutate_state(|state| prepare(args, state))? {
        // The transfer was certified, so the message has been tipped already
        PrepareResult::Tipped(user_id) => user_id,
        PrepareResult::Icrc2(tip) => {
            let TipToMake {
                user_id,
                spender_subaccount,
                c2c_args,
                transfer,
            } = *tip;

            match ledger_utils::icrc2::process_transaction_for_user(transfer, spender_subaccount).await {
                Ok(Ok(_)) => {}
                Ok(Err((_, error))) => return Err(error),
                Err(error) => return Err(error.into()),
            }

            mutate_state(|state| tip_message_with_completed_transfer(user_id, c2c_args, state))?;
            user_id
        }
    };

    if new_achievement {
        mutate_state(|state| state.notify_user_of_achievement(user_id, Achievement::TippedMessage, state.env.now()));
    }
    Ok(())
}

enum PrepareResult {
    Tipped(UserId),
    Icrc2(Box<TipToMake>),
}

struct TipToMake {
    user_id: UserId,
    // The caller's spender subaccount, under which they approved the transfer
    spender_subaccount: [u8; 32],
    c2c_args: TipToRecord,
    transfer: icrc2::PendingCryptoTransaction,
}

fn prepare(args: Args, state: &mut RuntimeState) -> OCResult<PrepareResult> {
    let Caller::User(user) = state.verified_caller(None)? else {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    };
    let user_id = user.user_id;

    let recipient = state.data.channels.get_or_err(&args.channel_id)?.chat.check_can_tip_message(
        user_id,
        args.thread_root_message_index,
        args.message_id,
        &state.data.migrated_user_ids,
    )?;

    let c2c_args = TipToRecord {
        recipient,
        channel_id: args.channel_id,
        thread_root_message_index: args.thread_root_message_index,
        message_id: args.message_id,
        ledger: args.transfer.ledger_canister_id(),
        token_symbol: args.transfer.token_symbol().to_string(),
        amount: args.transfer.units(),
        decimals: args.decimals,
        username: args.username,
        display_name: args.display_name,
    };

    let this_canister_id = state.env.canister_id();
    let transfer_recipient = TransferRecipient::User {
        user_id: recipient,
        wallet: state.member_wallet(recipient)?,
    };

    match UserTransfer::new(
        CryptoTransaction::Pending(args.transfer),
        transfer_recipient,
        &MEMO_TIP,
        this_canister_id,
    )? {
        UserTransfer::Icrc2(transfer) => Ok(PrepareResult::Icrc2(Box::new(TipToMake {
            user_id,
            spender_subaccount: ledger_utils::spender_subaccount(user.principal),
            c2c_args,
            transfer,
        }))),
        UserTransfer::Certified(transfer) => {
            let now = state.env.now();
            let completed = state.data.certified_transfers.verify(
                transfer,
                state.env.caller(),
                &MEMO_TIP,
                this_canister_id,
                &state.env.ic_root_key(),
                now,
            )?;
            tip_message_with_completed_transfer(user_id, c2c_args, state)?;
            state.data.certified_transfers.mark_used(&completed, now);
            Ok(PrepareResult::Tipped(user_id))
        }
    }
}

// What is recorded of a tip once its transfer has been made
struct TipToRecord {
    channel_id: ChannelId,
    recipient: UserId,
    thread_root_message_index: Option<MessageIndex>,
    message_id: MessageId,
    ledger: CanisterId,
    token_symbol: String,
    amount: u128,
    decimals: u8,
    username: String,
    display_name: Option<String>,
}

// Records a tip whose transfer has been made
fn tip_message_with_completed_transfer(user_id: UserId, args: TipToRecord, state: &mut RuntimeState) -> OCResult {
    let channel = state.data.channels.get_mut_or_err(&args.channel_id)?;
    let now = state.env.now();

    let tip_message_args = TipMessageArgs {
        user_id,
        recipient: args.recipient,
        thread_root_message_index: args.thread_root_message_index,
        message_id: args.message_id,
        ledger: args.ledger,
        token_symbol: args.token_symbol.clone(),
        amount: args.amount,
        now,
    };

    let result = channel.chat.tip_message(
        tip_message_args,
        &state.data.migrated_user_ids,
        CommunityEventPusher {
            now,
            rng: state.env.rng(),
            queue: &mut state.data.local_user_index_event_sync_queue,
        },
    )?;

    if let Some((message, event_index)) =
        channel
            .chat
            .events
            .message_internal(EventIndex::default(), args.thread_root_message_index, args.message_id.into())
        // The sender is a member under their latest id, in case they have been migrated since
        // sending the message
        && let sender_id = state.data.migrated_user_ids.latest(message.sender)
        && let Some(sender) = channel.chat.members.get(&sender_id)
        && sender_id != user_id
        && !sender.user_type().is_bot()
    {
        let community_id = state.env.canister_id().into();
        let event = CommunityCanisterEvent::MessageActivity(MessageActivityEvent {
            chat: Chat::Channel(community_id, channel.id),
            thread_root_message_index: args.thread_root_message_index,
            message_index: message.message_index,
            message_id: message.message_id,
            event_index,
            activity: MessageActivity::Tip,
            timestamp: now,
            user_id: Some(user_id),
        });

        let channel_avatar_id = channel.chat.avatar.as_ref().map(|a| a.id);
        let tip = format_crypto_amount_with_symbol(args.amount, args.decimals, &args.token_symbol);
        let notification = ChannelUserNotificationPayload::ChannelMessageTipped(ChannelMessageTipped {
            community_id,
            channel_id: channel.id,
            thread_root_message_index: args.thread_root_message_index,
            message_index: message.message_index,
            message_event_index: event_index,
            community_name: state.data.name.value.clone(),
            channel_name: channel.chat.name.value.clone(),
            tipped_by: user_id,
            tipped_by_name: args.username,
            tipped_by_display_name: args.display_name,
            tip,
            community_avatar_id: state.data.avatar.as_ref().map(|a| a.id),
            channel_avatar_id,
        });

        state.push_notification(Some(user_id), vec![sender_id], notification);
        state.push_event_to_user(sender_id, event, now);
        state.notify_user_of_achievement(sender_id, Achievement::HadMessageTipped, now);
    }

    state.push_bot_notification(result.bot_notification);
    handle_activity_notification(state);
    Ok(())
}
