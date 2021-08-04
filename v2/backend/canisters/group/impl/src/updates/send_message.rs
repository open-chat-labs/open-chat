use crate::model::events::PushMessageArgs;
use crate::updates::handle_activity_notification;
use crate::{RuntimeState, RUNTIME_STATE};
use group_canister::updates::send_message::{Response::*, *};
use ic_cdk_macros::update;
use notifications_canister::updates::push_group_message_notification;
use shared::rand::get_random_item;
use shared::types::notifications::GroupMessageNotification;
use shared::types::CanisterId;

#[update]
fn send_message(args: Args) -> Response {
    handle_activity_notification();

    RUNTIME_STATE.with(|state| send_message_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn send_message_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get_by_principal(&caller) {
        let now = runtime_state.env.now();

        let push_message_args = PushMessageArgs {
            sender: participant.user_id,
            message_id: args.message_id,
            content: args.content,
            replies_to: args.replies_to,
            now,
        };

        let (event_index, message) = runtime_state.data.events.push_message(push_message_args);
        let message_index = message.message_index;

        let random = runtime_state.env.random_u32() as usize;

        if let Some(canister_id) = get_random_item(&runtime_state.data.notification_canister_ids, random) {
            let notification = GroupMessageNotification {
                chat_id: runtime_state.env.canister_id().into(),
                group_name: runtime_state.data.name.clone(),
                sender: participant.user_id,
                sender_name: args.sender_name,
                recipients: runtime_state.data.participants.get_other_user_ids(participant.user_id),
                message,
            };
            ic_cdk::block_on(push_notification(*canister_id, notification));
        }

        Success(SuccessResult {
            event_index,
            message_index,
            timestamp: now,
        })
    } else {
        NotInGroup
    }
}

async fn push_notification(canister_id: CanisterId, notification: GroupMessageNotification) {
    let args = push_group_message_notification::Args { notification };
    let _ = c2c::notifications::push_group_message_notification(canister_id, &args).await;
}

mod c2c {
    use super::*;
    use ic_cdk::api::call::CallResult;
    use log::error;
    use shared::generate_c2c_call;

    pub mod notifications {
        use super::*;

        generate_c2c_call!(push_group_message_notification);
    }
}
