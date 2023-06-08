use crate::{activity_notifications::handle_activity_notification, mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use community_canister::pin_message::{Response::*, *};
use group_chat_core::PinUnpinMessageResult;
use ic_cdk_macros::update;

#[update]
#[trace]
fn pin_message(args: Args) -> Response {
    mutate_state(|state| pin_message_impl(args, true, state))
}

#[update]
#[trace]
fn unpin_message(args: Args) -> Response {
    mutate_state(|state| pin_message_impl(args, false, state))
}

fn pin_message_impl(args: Args, pin: bool, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return CommunityFrozen;
    }

    let caller = state.env.caller();
    if let Some(member) = state.data.members.get(caller) {
        if member.suspended.value {
            return UserSuspended;
        }

        let user_id = member.user_id;

        if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
            let now = state.env.now();

            let result = if pin {
                channel.chat.pin_message(user_id, args.message_index, now)
            } else {
                channel.chat.unpin_message(user_id, args.message_index, now)
            };

            match result {
                PinUnpinMessageResult::Success(r) => {
                    handle_activity_notification(state);
                    Success(r)
                }
                PinUnpinMessageResult::NoChange => NoChange,
                PinUnpinMessageResult::NotAuthorized => NotAuthorized,
                PinUnpinMessageResult::MessageNotFound => MessageNotFound,
                PinUnpinMessageResult::UserSuspended => UserSuspended,
                PinUnpinMessageResult::UserNotInGroup => UserNotInChannel,
            }
        } else {
            ChannelNotFound
        }
    } else {
        UserNotInCommunity
    }
}
