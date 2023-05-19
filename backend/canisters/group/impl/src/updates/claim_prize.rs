use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use candid::Principal;
use canister_tracing_macros::trace;
use chat_events::{PushMessageArgs, ReservePrizeResult};
use group_canister::claim_prize::{Response::*, *};
use ic_cdk_macros::update;
use ic_ledger_types::Tokens;
use ledger_utils::{nns, sns};
use types::nns::UserOrAccount;
use types::{
    CanisterId, CompletedCryptoTransaction, Cryptocurrency, GroupMessageNotification, MessageContentInternal, MessageId,
    Notification, PendingCryptoTransaction, PrizeWinnerContent, UserId,
};
use utils::consts::{OPENCHAT_BOT_USERNAME, OPENCHAT_BOT_USER_ID};

#[update]
#[trace]
async fn claim_prize(args: Args) -> Response {
    run_regular_jobs();

    // Validate the request and reserve a prize
    let prepare_result = match mutate_state(|state| prepare(&args, state)) {
        Ok(c) => c,
        Err(response) => return *response,
    };

    // Transfer the prize to the winner
    let result = match prepare_result.transaction {
        PendingCryptoTransaction::NNS(t) => {
            nns::process_transaction(t, prepare_result.group, prepare_result.ledger_canister_id).await
        }
        PendingCryptoTransaction::SNS(t) => {
            sns::process_transaction(t, prepare_result.group, prepare_result.ledger_canister_id).await
        }
    };

    match result {
        Ok(completed_transaction) => {
            // Claim the prize and send a message to the group
            if let Some(error_message) =
                mutate_state(|state| commit(args, prepare_result.user_id, completed_transaction.clone(), state))
            {
                FailedAfterTransfer(error_message, completed_transaction)
            } else {
                Success
            }
        }
        Err(failed_transaction) => {
            // Rollback the prize reservation
            let error_message =
                mutate_state(|state| rollback(args, prepare_result.user_id, failed_transaction.amount(), state));
            TransferFailed(error_message, failed_transaction)
        }
    }
}

struct PrepareResult {
    pub transaction: PendingCryptoTransaction,
    pub group: CanisterId,
    pub ledger_canister_id: CanisterId,
    pub user_id: UserId,
}

fn prepare(args: &Args, state: &mut RuntimeState) -> Result<PrepareResult, Box<Response>> {
    if state.data.is_frozen() {
        return Err(Box::new(ChatFrozen));
    }

    let caller = state.env.caller();

    if let Some(member) = state.data.get_member(caller) {
        if member.suspended.value {
            return Err(Box::new(UserSuspended));
        }

        let now = state.env.now();
        let now_nanos = state.env.now_nanos();
        let min_visible_event_index = member.min_visible_event_index();
        let user_id = member.user_id;

        let (token, amount) = match state
            .data
            .chat
            .events
            .reserve_prize(args.message_id, min_visible_event_index, user_id, now)
        {
            ReservePrizeResult::AlreadyClaimed => return Err(Box::new(AlreadyClaimed)),
            ReservePrizeResult::Success(token, amount) => (token, amount),
            ReservePrizeResult::MessageNotFound => return Err(Box::new(MessageNotFound)),
            ReservePrizeResult::PrizeFullyClaimed => return Err(Box::new(PrizeFullyClaimed)),
            ReservePrizeResult::PrizeEnded => return Err(Box::new(PrizeEnded)),
        };

        let principal = ic_base_types::PrincipalId::from(Principal::from(user_id));

        let transaction = match token {
            Cryptocurrency::InternetComputer => PendingCryptoTransaction::NNS(types::nns::PendingCryptoTransaction {
                token,
                amount,
                to: UserOrAccount::User(user_id),
                fee: None,
                memo: None,
                created: now_nanos,
            }),
            _ => PendingCryptoTransaction::SNS(types::sns::PendingCryptoTransaction {
                token,
                amount,
                to: ic_icrc1::Account {
                    owner: principal,
                    subaccount: None,
                },
                fee: Tokens::from_e8s(token.fee() as u64),
                memo: None,
                created: now_nanos,
            }),
        };

        Ok(PrepareResult {
            group: state.env.canister_id(),
            ledger_canister_id: transaction.token().ledger_canister_id(),
            transaction,
            user_id,
        })
    } else {
        Err(Box::new(CallerNotInGroup))
    }
}

fn commit(args: Args, winner: UserId, transaction: CompletedCryptoTransaction, state: &mut RuntimeState) -> Option<String> {
    let now = state.env.now();
    match state.data.chat.events.claim_prize(args.message_id, winner, now) {
        chat_events::ClaimPrizeResult::Success(message_index) => {
            // Push a PrizeWinnerContent message to the group from the OpenChatBot
            let message_event = state.data.chat.events.push_message(PushMessageArgs {
                sender: OPENCHAT_BOT_USER_ID,
                thread_root_message_index: None,
                message_id: MessageId::generate(state.env.rng()),
                content: MessageContentInternal::PrizeWinner(PrizeWinnerContent {
                    winner,
                    transaction,
                    prize_message: message_index,
                }),
                replies_to: None,
                forwarded: false,
                correlation_id: args.correlation_id,
                now,
            });

            // Send a notification to group participants
            let notification_recipients = state.data.chat.members.users_to_notify(None).into_iter().collect();

            let notification = Notification::GroupMessageNotification(GroupMessageNotification {
                chat_id: state.env.canister_id().into(),
                thread_root_message_index: None,
                group_name: state.data.chat.name.clone(),
                sender: OPENCHAT_BOT_USER_ID,
                sender_name: OPENCHAT_BOT_USERNAME.to_string(),
                message: message_event,
                mentioned: Vec::new(),
            });

            state.push_notification(notification_recipients, notification);

            handle_activity_notification(state);
            None
        }
        chat_events::ClaimPrizeResult::MessageNotFound => Some("MessageNotFound".to_string()),
        chat_events::ClaimPrizeResult::ReservationNotFound => Some("ReservationNotFound".to_string()),
    }
}

fn rollback(args: Args, user_id: UserId, amount: Tokens, state: &mut RuntimeState) -> String {
    let now = state.env.now();
    match state.data.chat.events.unreserve_prize(args.message_id, user_id, amount, now) {
        chat_events::UnreservePrizeResult::Success => "prize reservation cancelled".to_string(),
        chat_events::UnreservePrizeResult::MessageNotFound => "prize message not found".to_string(),
        chat_events::UnreservePrizeResult::ReservationNotFound => "prize reservation not found".to_string(),
    }
}
