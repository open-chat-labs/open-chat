use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::ReservePrizeResult;
use group_canister::claim_prize::{Response::*, *};
use ic_cdk_macros::update;
use ic_ledger_types::Tokens;
use ledger_utils::{create_pending_transaction, process_transaction};
use types::{CanisterId, CompletedCryptoTransaction, GroupMessageNotification, Notification, PendingCryptoTransaction, UserId};
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
    let result = process_transaction(prepare_result.transaction, prepare_result.group).await;

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
            let e8s = failed_transaction.units() as u64;
            // Rollback the prize reservation
            let error_message = mutate_state(|state| rollback(args, prepare_result.user_id, Tokens::from_e8s(e8s), state));
            TransferFailed(error_message, failed_transaction)
        }
    }
}

struct PrepareResult {
    pub transaction: PendingCryptoTransaction,
    pub group: CanisterId,
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

        let transaction = create_pending_transaction(token, amount, user_id, now_nanos);

        Ok(PrepareResult {
            group: state.env.canister_id(),
            transaction,
            user_id,
        })
    } else {
        Err(Box::new(CallerNotInGroup))
    }
}

fn commit(args: Args, winner: UserId, transaction: CompletedCryptoTransaction, state: &mut RuntimeState) -> Option<String> {
    let now = state.env.now();
    match state
        .data
        .chat
        .events
        .claim_prize(args.message_id, winner, transaction, state.env.rng(), now)
    {
        chat_events::ClaimPrizeResult::Success(message_event) => {
            // Send a notification to group participants
            let notification_recipients = state.data.chat.members.users_to_notify(None).into_iter().collect();
            let content = &message_event.event.content;

            let notification = Notification::GroupMessage(GroupMessageNotification {
                chat_id: state.env.canister_id().into(),
                thread_root_message_index: None,
                message_index: message_event.event.message_index,
                event_index: message_event.index,
                group_name: state.data.chat.name.clone(),
                sender: OPENCHAT_BOT_USER_ID,
                sender_name: OPENCHAT_BOT_USERNAME.to_string(),
                message_type: content.message_type().to_string(),
                message_text: content.notification_text(&[]),
                image_url: content.notification_image_url(),
                group_avatar_id: state.data.chat.avatar.as_ref().map(|d| d.id),
                crypto_transfer: None,
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
