use crate::activity_notifications::handle_activity_notification;
use crate::{CommunityEventPusher, RuntimeState, execute_update_async, mutate_state, read_state};
use candid::Principal;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::TipMessageArgs;
use community_canister::tip_message::*;
use constants::MEMO_TIP;
use group_chat_core::{AccountLink, TipRecipient, check_tip_can_be_held};
use ledger_utils::{TransferRecipient, UserTransfer, format_crypto_amount_with_symbol};
use local_user_index_canister::{BridgedUserDeposit, CommunityEvent, c2c_bridged_user_link};
use multi_user_canister::{CommunityCanisterEvent, MessageActivity, MessageActivityEvent};
use oc_error_codes::OCErrorCode;
use types::{
    Achievement, BridgedUserId, Caller, CanisterId, ChannelId, ChannelMessageTipped, ChannelUserNotificationPayload, Chat,
    CryptoTransaction, EventIndex, MessageId, MessageIndex, OCResult, UserId, icrc1, icrc2,
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

    let prepared = match mutate_state(|state| prepare(&args, user.user_id, caller, None, None, state))? {
        // Tips on a message a bridge bot relayed go to whoever linked the account it came from,
        // which the LocalUserIndex knows. Everything is checked again once they're found, as
        // anything may have changed while they were looked up.
        PrepareResult::LookUpLinkedUser(bridged_user, local_user_index) => {
            let link = match local_user_index_canister_c2c_client::bridged_user_link(bridged_user, local_user_index).await? {
                c2c_bridged_user_link::Response::Success(Some(linked_user)) => AccountLink::Linked(linked_user),
                c2c_bridged_user_link::Response::Success(None) => AccountLink::Unlinked,
                c2c_bridged_user_link::Response::CantBeLinked => AccountLink::CantBeLinked,
            };
            mutate_state(|state| prepare(&args, user.user_id, caller, Some(link), None, state))?
        }
        // A sender who has left the community is no longer held among its members, so the wallet
        // to pay them in is looked up from the LocalUserIndex, then everything is checked again
        PrepareResult::LookUpWallet(recipient, local_user_index) => {
            let wallet =
                match local_user_index_canister_c2c_client::lookup_user(recipient.as_principal(), local_user_index).await? {
                    // The lookup also resolves the principal a user signs in with, which isn't their user id
                    Some(found) if found.user_id == recipient => found.principal.into(),
                    _ => return Err(OCErrorCode::TargetUserNotFound.into()),
                };
            mutate_state(|state| prepare(&args, user.user_id, caller, None, Some((recipient, wallet)), state))?
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
        // Only asked for before anything has been looked up, as a linked user must be a member
        PrepareResult::LookUpLinkedUser(..) | PrepareResult::LookUpWallet(..) => {
            return Err(OCErrorCode::TargetUserNotFound.into());
        }
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
    // The message's sender has left the community, so their wallet is to be looked up from this
    // LocalUserIndex, then the tip prepared again with it
    LookUpWallet(UserId, CanisterId),
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
    // The wallet of a user who isn't a member of the community, as looked up
    non_member_wallet: Option<(UserId, icrc1::Account)>,
    state: &mut RuntimeState,
) -> OCResult<PrepareResult> {
    let payee = match state.data.channels.get_or_err(&args.channel_id)?.chat.check_can_tip_message(
        user_id,
        args.thread_root_message_index,
        args.message_id,
        link,
    )? {
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
        channel_id: args.channel_id,
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
            // A community member's wallet is held for them, even once they've left the channel,
            // and a bot has none (see `member_wallet`). A user who has left the community is paid
            // in the wallet looked up for them.
            wallet: if !recipient.is_indexed() || state.data.members.get_by_user_id(&recipient).is_some() {
                state.member_wallet(recipient)?
            } else if let Some((non_member, wallet)) = non_member_wallet
                && non_member == recipient
            {
                wallet
            } else {
                return Ok(PrepareResult::LookUpWallet(
                    recipient,
                    state.data.local_user_index_canister_id,
                ));
            },
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
    channel_id: ChannelId,
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
    // The UserIndex holds a tip for an account no one has linked. It's told first, as the funds are
    // there already, so even if the tip can't be recorded on the message, eg. as the channel has
    // been deleted since, it's still claimed or refunded.
    if let Payee::UnlinkedAccount(account) = args.payee {
        state.push_event_to_local_user_index(CommunityEvent::BridgedUserDeposit(Box::new(BridgedUserDeposit {
            channel_id: Some(args.channel_id),
            thread_root_message_index: args.thread_root_message_index,
            message_id: args.message_id,
            account,
            sender: user_id,
            refund_to: from,
            ledger: args.ledger,
            token_symbol: args.token_symbol.clone(),
            amount: args.amount,
            fee: args.fee,
            decimals: args.decimals,
        })));
    }

    let channel = state.data.channels.get_mut_or_err(&args.channel_id)?;
    let now = state.env.now();

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

    let result = channel.chat.tip_message(
        tip_message_args,
        CommunityEventPusher {
            now,
            rng: state.env.rng(),
            queue: &mut state.data.local_user_index_event_sync_queue,
        },
    )?;

    // Whoever the tip went to, its sender, or for a relayed message whoever linked its account, is
    // told of it
    if let Payee::User(recipient_id) = args.payee
        && let Some((message, event_index)) =
            channel
                .chat
                .events
                .message_internal(EventIndex::default(), args.thread_root_message_index, args.message_id.into())
        && let Some(recipient) = channel.chat.members.get(&recipient_id)
        && recipient_id != user_id
        && !recipient.user_type().is_bot()
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

        state.push_notification(Some(user_id), vec![recipient_id], notification);
        state.push_event_to_user(recipient_id, event, now);
        state.notify_user_of_achievement(recipient_id, Achievement::HadMessageTipped, now);
    }

    state.push_bot_notification(result.bot_notification);
    handle_activity_notification(state);
    Ok(())
}
