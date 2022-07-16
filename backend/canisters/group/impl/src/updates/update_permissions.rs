use crate::updates::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use group_canister::update_permissions::{Response::*, *};
use ic_cdk_macros::update;
use types::{GroupPermissions, PermissionsChanged};

#[update]
#[trace]
async fn update_permissions(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| update_permissions_impl(args, state))
}

fn update_permissions_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();

    if let Some(participant) = runtime_state.data.participants.get_by_principal(&caller) {
        if !participant.role.can_change_permissions(&runtime_state.data.permissions) {
            return NotAuthorized;
        }

        let old_permissions = runtime_state.data.permissions.clone();
        let new_permissions = merge_permissions(args, &old_permissions);
        runtime_state.data.permissions = new_permissions.clone();

        runtime_state.data.events.push_main_event(
            ChatEventInternal::PermissionsChanged(Box::new(PermissionsChanged {
                old_permissions,
                new_permissions,
                changed_by: participant.user_id,
            })),
            runtime_state.env.now(),
        );

        handle_activity_notification(runtime_state);

        Success
    } else {
        CallerNotInGroup
    }
}

fn merge_permissions(new: Args, old: &GroupPermissions) -> GroupPermissions {
    GroupPermissions {
        change_permissions: new.change_permissions.unwrap_or(old.change_permissions),
        change_roles: new.change_roles.unwrap_or(old.change_roles),
        add_members: new.add_members.unwrap_or(old.add_members),
        remove_members: new.remove_members.unwrap_or(old.remove_members),
        block_users: new.block_users.unwrap_or(old.block_users),
        delete_messages: new.delete_messages.unwrap_or(old.delete_messages),
        update_group: new.update_group.unwrap_or(old.update_group),
        pin_messages: new.pin_messages.unwrap_or(old.pin_messages),
        invite_users: new.invite_users.unwrap_or(old.invite_users),
        create_polls: new.create_polls.unwrap_or(old.create_polls),
        send_messages: new.send_messages.unwrap_or(old.send_messages),
        react_to_messages: new.react_to_messages.unwrap_or(old.react_to_messages),
        reply_in_thread: new.reply_in_thread.unwrap_or(old.reply_in_thread),
    }
}
