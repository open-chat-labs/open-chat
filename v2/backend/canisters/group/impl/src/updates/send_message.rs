use crate::updates::handle_activity_notification;
use crate::{run_regular_jobs, RuntimeState, RUNTIME_STATE};
use canister_api_macros::trace;
use chat_events::PushMessageArgs;
use group_canister::send_message::{Response::*, *};
use ic_cdk_macros::update;
use notifications_canister::push_group_message_notification;
use types::{CanisterId, GroupMessageNotification, UserId};
use utils::rand::get_random_item;

#[update]
#[trace]
fn send_message(args: Args) -> Response {
    run_regular_jobs();

    RUNTIME_STATE.with(|state| send_message_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn send_message_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get_by_principal_mut(&caller) {
        let now = runtime_state.env.now();
        let sender = participant.user_id;

        let push_message_args = PushMessageArgs {
            sender,
            message_id: args.message_id,
            content: args.content,
            replies_to: args.replies_to.map(|r| r.into()),
            now,
        };

        let (event_index, message) = runtime_state.data.events.push_message(push_message_args);

        handle_activity_notification(runtime_state);

        let random = runtime_state.env.random_u32() as usize;
        let message_index = message.message_index;

        if let Some(canister_id) = get_random_item(&runtime_state.data.notification_canister_ids, random) {
            let notification = GroupMessageNotification {
                chat_id: runtime_state.env.canister_id().into(),
                group_name: runtime_state.data.name.clone(),
                sender,
                sender_name: args.sender_name,
                message,
            };
            let recipients = runtime_state.data.participants.users_to_notify(sender);

            ic_cdk::block_on(push_notification(*canister_id, recipients, notification));
        }

        Success(SuccessResult {
            event_index,
            message_index,
            timestamp: now,
        })
    } else {
        CallerNotInGroup
    }
}

async fn push_notification(canister_id: CanisterId, recipients: Vec<UserId>, notification: GroupMessageNotification) {
    let args = push_group_message_notification::Args {
        recipients,
        notification,
    };
    let _ = notifications_canister_c2c_client::push_group_message_notification(canister_id, &args).await;
}
