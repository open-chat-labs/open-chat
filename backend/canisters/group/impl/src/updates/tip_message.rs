use crate::activity_notifications::handle_activity_notification;
use crate::{GroupEventPusher, RuntimeState, execute_update_async, mutate_state, read_state};
use candid::Principal;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::TipMessageArgs;
use constants::MEMO_TIP;
use group_canister::tip_message::*;
use group_chat_core::{AccountLink, TipRecipient, check_tip_can_be_held};
use ledger_utils::{TransferRecipient, UserTransfer, format_crypto_amount_with_symbol};
use local_user_index_canister::{BridgedUserTipped, GroupEvent, c2c_bridged_user_link};
use multi_user_canister::{GroupCanisterEvent, MessageActivity, MessageActivityEvent};
use oc_error_codes::OCErrorCode;
use types::{
    Achievement, BridgedUserId, Caller, CanisterId, Chat, ChatId, CryptoTransaction, EventIndex,
    GroupChatUserNotificationPayload, GroupMessageTipped, MessageId, MessageIndex, OCResult, UserId, icrc1, icrc2,
};

#[update(msgpack = true)]
#[trace]
async fn tip_message(args: Args) -> Response {
    execute_update_async(|| tip_message_impl(args)).await.into()
}

async fn tip_message_impl(args: Args) -> OCResult {
    let new_achievement = args.new_achievement;

    // Who's tipping is found once, before anything is awaited. Each `prepare` checks again that
    // they can tip the message.
    let (user, caller) = read_state(|state| -> OCResult<_> {
        match state.verified_caller(None)? {
            Caller::User(user) => Ok((user, state.env.caller())),
            _ => Err(OCErrorCode::InitiatorNotAuthorized.into()),
        }
    })?;

    let prepared = match mutate_state(|state| prepare(&args, user.user_id, caller, None, state))? {
        // Tips on a message a bridge bot relayed go to whoever linked the account it came from,
        // which the LocalUserIndex knows. Everything is checked again once they're found, as
        // anything may have changed while they were looked up.
        PrepareResult::LookUpLinkedUser(bridged_user, local_user_index) => {
            let link = match local_user_index_canister_c2c_client::bridged_user_link(bridged_user, local_user_index).await? {
                c2c_bridged_user_link::Response::Success(Some(linked_user)) => AccountLink::Linked(linked_user),
                c2c_bridged_user_link::Response::Success(None) => AccountLink::Unlinked,
                c2c_bridged_user_link::Response::CantBeLinked => AccountLink::CantBeLinked,
            };
            mutate_state(|state| prepare(&args, user.user_id, caller, Some(link), state))?
        }
        prepared => prepared,
    };

    match prepared {
        // The transfer was certified, so the message has been tipped already
        PrepareResult::Tipped => {}
        PrepareResult::Icrc2(tip) => {
            let TipToMake { c2c_args, transfer } = *tip;
            let from = transfer.from;

            // The caller approved the transfer under their spender subaccount
            let spender_subaccount = ledger_utils::spender_subaccount(user.principal);
            match ledger_utils::icrc2::process_transaction_for_user(transfer, spender_subaccount).await {
                Ok(Ok(_)) => {}
                Ok(Err((_, error))) => return Err(error),
                Err(error) => return Err(error.into()),
            }

            mutate_state(|state| tip_message_with_completed_transfer(user.user_id, from, c2c_args, state))?;
        }
        // Only asked for when no link was given
        PrepareResult::LookUpLinkedUser(..) => return Err(OCErrorCode::TargetUserNotFound.into()),
    }

    if new_achievement {
        mutate_state(|state| state.notify_user_of_achievement(user.user_id, Achievement::TippedMessage, state.env.now()));
    }
    Ok(())
}

enum PrepareResult {
    Tipped,
    Icrc2(Box<TipToMake>),
    // The message was relayed by a bridge bot from this account, so who linked it is to be looked
    // up from this LocalUserIndex, then the tip prepared again with them
    LookUpLinkedUser(BridgedUserId, CanisterId),
}

struct TipToMake {
    c2c_args: TipToRecord,
    transfer: icrc2::PendingCryptoTransaction,
}

fn prepare(
    args: &Args,
    user_id: UserId,
    caller: Principal,
    link: Option<AccountLink>,
    state: &mut RuntimeState,
) -> OCResult<PrepareResult> {
    let payee = match state
        .data
        .chat
        .check_can_tip_message(user_id, args.thread_root_message_index, args.message_id, link)?
    {
        TipRecipient::User(recipient) => Payee::User(recipient),
        TipRecipient::LinkedUserOf(user) => {
            return Ok(PrepareResult::LookUpLinkedUser(user, state.data.local_user_index_canister_id));
        }
        TipRecipient::UnlinkedAccount(account) => {
            check_tip_can_be_held(&args.transfer)?;
            Payee::UnlinkedAccount(account)
        }
    };

    let c2c_args = TipToRecord {
        payee,
        thread_root_message_index: args.thread_root_message_index,
        message_id: args.message_id,
        ledger: args.transfer.ledger_canister_id(),
        token_symbol: args.transfer.token_symbol().to_string(),
        amount: args.transfer.units(),
        fee: args.transfer.fee(),
        decimals: args.decimals,
        username: args.username.clone(),
        display_name: args.display_name.clone(),
    };

    let this_canister_id = state.env.canister_id();
    let transfer_recipient = match payee {
        Payee::User(recipient) => TransferRecipient::User {
            user_id: recipient,
            wallet: state.member_wallet(recipient)?,
        },
        Payee::UnlinkedAccount(account) => TransferRecipient::Account(icrc1::Account {
            owner: state.data.user_index_canister_id,
            subaccount: Some(account.subaccount()),
        }),
    };

    match UserTransfer::new(
        CryptoTransaction::Pending(args.transfer.clone()),
        transfer_recipient,
        &MEMO_TIP,
        this_canister_id,
    )? {
        UserTransfer::Icrc2(transfer) => Ok(PrepareResult::Icrc2(Box::new(TipToMake { c2c_args, transfer }))),
        // A certified transfer has been made already, so one into an account's subaccount
        // would be stranded there if the tip were then refused, eg. as someone had linked it since
        UserTransfer::Certified(_) if matches!(payee, Payee::UnlinkedAccount(_)) => {
            Err(OCErrorCode::InvalidRequest.with_message("A tip for an account no one has linked must be an ICRC2 transfer"))
        }
        UserTransfer::Certified(transfer) => {
            let now = state.env.now();
            let completed = state.data.certified_transfers.verify(
                transfer,
                caller,
                &MEMO_TIP,
                this_canister_id,
                &state.env.ic_root_key(),
                now,
            )?;
            let icrc1::CryptoAccount::Account(from) = completed.from else {
                return Err(OCErrorCode::InvalidRequest.with_message("Transfer must be from an account"));
            };
            tip_message_with_completed_transfer(user_id, from, c2c_args, state)?;
            state.data.certified_transfers.mark_used(&completed, now);
            Ok(PrepareResult::Tipped)
        }
    }
}

// Who a tip is paid to
#[derive(Clone, Copy)]
enum Payee {
    User(UserId),
    // An account no one has linked, whose tips the UserIndex holds for whoever does
    UnlinkedAccount(BridgedUserId),
}

// What is recorded of a tip once its transfer has been made
struct TipToRecord {
    payee: Payee,
    thread_root_message_index: Option<MessageIndex>,
    message_id: MessageId,
    ledger: CanisterId,
    token_symbol: String,
    amount: u128,
    fee: u128,
    decimals: u8,
    username: String,
    display_name: Option<String>,
}

// Records a tip whose transfer, from the account `from`, has been made
fn tip_message_with_completed_transfer(
    user_id: UserId,
    from: icrc1::Account,
    args: TipToRecord,
    state: &mut RuntimeState,
) -> OCResult {
    let now = state.env.now();

    // The UserIndex holds a tip for an account no one has linked. It's told first, as the funds are
    // there already, so even if the tip can't be recorded on the message, eg. as the tipper has left
    // since, it's still claimed or refunded.
    if let Payee::UnlinkedAccount(account) = args.payee {
        state.push_event_to_local_user_index(GroupEvent::BridgedUserTipped(Box::new(BridgedUserTipped {
            channel_id: None,
            thread_root_message_index: args.thread_root_message_index,
            message_id: args.message_id,
            account,
            tipper: user_id,
            refund_to: from,
            ledger: args.ledger,
            token_symbol: args.token_symbol.clone(),
            amount: args.amount,
            fee: args.fee,
            decimals: args.decimals,
        })));
    }

    let tip_message_args = TipMessageArgs {
        user_id,
        recipient: match args.payee {
            Payee::User(recipient) => Some(recipient),
            Payee::UnlinkedAccount(_) => None,
        },
        thread_root_message_index: args.thread_root_message_index,
        message_id: args.message_id,
        ledger: args.ledger,
        token_symbol: args.token_symbol.clone(),
        amount: args.amount,
        now,
    };

    let result = state.data.chat.tip_message(
        tip_message_args,
        GroupEventPusher {
            now,
            rng: state.env.rng(),
            queue: &mut state.data.local_user_index_event_sync_queue,
        },
    )?;

    // Whoever the tip went to, its sender, or for a relayed message whoever linked its account, is
    // told of it
    if let Payee::User(recipient_id) = args.payee
        && let Some((message, event_index)) = state.data.chat.events.message_internal(
            EventIndex::default(),
            args.thread_root_message_index,
            args.message_id.into(),
        )
        && let Some(recipient) = state.data.chat.members.get(&recipient_id)
        && recipient_id != user_id
        && !recipient.user_type().is_bot()
    {
        let chat_id: ChatId = state.env.canister_id().into();
        let tip = format_crypto_amount_with_symbol(args.amount, args.decimals, &args.token_symbol);
        let user_notification_payload = GroupChatUserNotificationPayload::GroupMessageTipped(GroupMessageTipped {
            chat_id,
            thread_root_message_index: args.thread_root_message_index,
            message_index: message.message_index,
            message_event_index: event_index,
            group_name: state.data.chat.name.value.clone(),
            tipped_by: user_id,
            tipped_by_name: args.username,
            tipped_by_display_name: args.display_name,
            tip,
            group_avatar_id: state.data.chat.avatar.as_ref().map(|a| a.id),
        });

        state.push_notification(Some(user_id), vec![recipient_id], user_notification_payload);

        state.push_event_to_user(
            recipient_id,
            GroupCanisterEvent::MessageActivity(MessageActivityEvent {
                chat: Chat::Group(chat_id),
                thread_root_message_index: args.thread_root_message_index,
                message_index: message.message_index,
                message_id: message.message_id,
                event_index,
                activity: MessageActivity::Tip,
                timestamp: now,
                user_id: Some(user_id),
            }),
            now,
        );

        state.notify_user_of_achievement(recipient_id, Achievement::HadMessageTipped, now);
    }

    state.push_bot_notification(result.bot_notification);
    handle_activity_notification(state);
    Ok(())
}
