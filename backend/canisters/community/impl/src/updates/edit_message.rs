use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::{EditMessageArgs, EditMessageResult};
use community_canister::edit_message::{Response::*, *};
use ic_cdk_macros::update;

#[update]
#[trace]
fn edit_message(args: Args) -> Response {
    mutate_state(|state| edit_message_impl(args, state))
}

fn edit_message_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return CommunityFrozen;
    }

    let caller = state.env.caller();
    if let Some(member) = state.data.members.get(caller) {
        if member.suspended.value {
            return UserSuspended;
        }

        let now = state.env.now();

        if let Some(group) = state.data.groups.get_mut(&args.group_id) {
            let sender = member.user_id;
            if let Some(group_member) = group.members.get(&sender) {
                match group.events.edit_message(EditMessageArgs {
                    sender,
                    min_visible_event_index: group_member.min_visible_event_index(),
                    thread_root_message_index: args.thread_root_message_index,
                    message_id: args.message_id,
                    content: args.content,
                    now,
                }) {
                    EditMessageResult::Success => Success,
                    EditMessageResult::NotAuthorized => MessageNotFound,
                    EditMessageResult::NotFound => MessageNotFound,
                }
            } else {
                UserNotInGroup
            }
        } else {
            GroupNotFound
        }
    } else {
        CallerNotInCommunity
    }
}
