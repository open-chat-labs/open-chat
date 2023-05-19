use crate::activity_notifications::handle_activity_notification;
use crate::updates::update_group_v2::Response::*;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use group_canister::update_group_v2::*;
use group_index_canister::c2c_update_group;
use ic_cdk_macros::update;
use tracing::error;
use types::{
    Avatar, AvatarChanged, CanisterId, ChatId, GroupDescriptionChanged, GroupGateUpdated, GroupNameChanged,
    GroupPermissionRole, GroupPermissions, GroupRulesChanged, OptionalGroupPermissions, PermissionsChanged, Timestamped,
    UserId,
};
use utils::avatar_validation::validate_avatar;
use utils::group_validation::{validate_description, validate_name, validate_rules, NameValidationError, RulesValidationError};

#[update]
#[trace]
async fn update_group_v2(mut args: Args) -> Response {
    run_regular_jobs();

    clean_args(&mut args);

    let prepare_result = match read_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    if prepare_result.is_public && (args.name.is_some() || args.description.is_some() || args.avatar.has_update()) {
        let c2c_update_group_args = c2c_update_group::Args {
            name: prepare_result.name,
            description: prepare_result.description,
            avatar_id: prepare_result.avatar_id,
        };

        let group_index_canister_id = prepare_result.group_index_canister_id;

        match group_index_canister_c2c_client::c2c_update_group(group_index_canister_id, &c2c_update_group_args).await {
            Ok(response) => match response {
                c2c_update_group::Response::Success => {}
                c2c_update_group::Response::NameTaken => return NameTaken,
                c2c_update_group::Response::ChatNotFound => {
                    error!(chat_id = %prepare_result.chat_id, "Group not found in index");
                    return InternalError;
                }
            },
            Err(_) => return InternalError,
        };
    }

    mutate_state(|state| commit(prepare_result.my_user_id, args, state));
    Success
}

fn clean_args(args: &mut Args) {
    args.name = args.name.as_ref().map(|name| name.trim().to_string());
    args.description = args.description.as_ref().map(|desc| desc.trim().to_string());

    if let Some(rules) = &mut args.rules {
        rules.text = rules.text.trim().to_string();
    }
}

struct PrepareResult {
    my_user_id: UserId,
    group_index_canister_id: CanisterId,
    is_public: bool,
    chat_id: ChatId,
    name: String,
    description: String,
    avatar_id: Option<u128>,
}

fn prepare(args: &Args, runtime_state: &RuntimeState) -> Result<PrepareResult, Response> {
    if runtime_state.data.is_frozen() {
        return Err(ChatFrozen);
    }

    let caller = runtime_state.env.caller();
    let avatar_update = args.avatar.as_ref().expand();

    if let Some(name) = &args.name {
        if let Err(error) = validate_name(name, runtime_state.data.chat.is_public) {
            return Err(match error {
                NameValidationError::TooShort(s) => NameTooShort(s),
                NameValidationError::TooLong(l) => NameTooLong(l),
                NameValidationError::Reserved => NameReserved,
            });
        }
    }

    if let Some(description) = &args.description {
        if let Err(error) = validate_description(description) {
            return Err(DescriptionTooLong(error));
        }
    }

    if let Some(rules) = &args.rules {
        if let Err(error) = validate_rules(rules.enabled, &rules.text) {
            return Err(match error {
                RulesValidationError::TooShort(s) => RulesTooShort(s),
                RulesValidationError::TooLong(l) => RulesTooLong(l),
            });
        }
    }

    if let Err(error) = avatar_update.map_or(Ok(()), validate_avatar) {
        return Err(AvatarTooBig(error));
    }

    if let Some(member) = runtime_state.data.get_member(caller) {
        if member.suspended.value {
            return Err(UserSuspended);
        }

        let permissions = &runtime_state.data.chat.permissions;
        if !member.role.can_update_group(permissions)
            || (args.permissions.is_some() && !member.role.can_change_permissions(permissions))
        {
            Err(NotAuthorized)
        } else {
            Ok(PrepareResult {
                my_user_id: member.user_id,
                group_index_canister_id: runtime_state.data.group_index_canister_id,
                is_public: runtime_state.data.chat.is_public,
                chat_id: runtime_state.env.canister_id().into(),
                name: args.name.as_ref().unwrap_or(&runtime_state.data.chat.name).clone(),
                description: args
                    .description
                    .as_ref()
                    .unwrap_or(&runtime_state.data.chat.description)
                    .clone(),
                avatar_id: avatar_update.map_or(Avatar::id(&runtime_state.data.chat.avatar), |avatar| avatar.map(|a| a.id)),
            })
        }
    } else {
        Err(CallerNotInGroup)
    }
}

fn commit(my_user_id: UserId, args: Args, runtime_state: &mut RuntimeState) {
    let now = runtime_state.env.now();
    let events = &mut runtime_state.data.chat.events;

    if let Some(name) = args.name {
        if runtime_state.data.chat.name != name {
            events.push_main_event(
                ChatEventInternal::GroupNameChanged(Box::new(GroupNameChanged {
                    new_name: name.clone(),
                    previous_name: runtime_state.data.chat.name.clone(),
                    changed_by: my_user_id,
                })),
                args.correlation_id,
                now,
            );

            runtime_state.data.chat.name = name;
        }
    }

    if let Some(description) = args.description {
        if runtime_state.data.chat.description != description {
            events.push_main_event(
                ChatEventInternal::GroupDescriptionChanged(Box::new(GroupDescriptionChanged {
                    new_description: description.clone(),
                    previous_description: runtime_state.data.chat.description.clone(),
                    changed_by: my_user_id,
                })),
                args.correlation_id,
                now,
            );

            runtime_state.data.chat.description = description;
        }
    }

    if let Some(rules) = args.rules {
        if runtime_state.data.chat.rules.enabled != rules.enabled || runtime_state.data.chat.rules.text != rules.text {
            events.push_main_event(
                ChatEventInternal::GroupRulesChanged(Box::new(GroupRulesChanged {
                    enabled: rules.enabled,
                    prev_enabled: runtime_state.data.chat.rules.enabled,
                    changed_by: my_user_id,
                })),
                args.correlation_id,
                now,
            );

            runtime_state.data.chat.rules = rules;
        }
    }

    if let Some(avatar) = args.avatar.expand() {
        let previous_avatar_id = Avatar::id(&runtime_state.data.chat.avatar);
        let new_avatar_id = Avatar::id(&avatar);

        if new_avatar_id != previous_avatar_id {
            events.push_main_event(
                ChatEventInternal::AvatarChanged(Box::new(AvatarChanged {
                    new_avatar: new_avatar_id,
                    previous_avatar: previous_avatar_id,
                    changed_by: my_user_id,
                })),
                args.correlation_id,
                now,
            );

            runtime_state.data.chat.avatar = avatar;
        }
    }

    if let Some(permissions) = args.permissions {
        let old_permissions = runtime_state.data.chat.permissions.clone();
        let new_permissions = merge_permissions(permissions, &old_permissions);
        runtime_state.data.chat.permissions = new_permissions.clone();

        runtime_state.data.chat.events.push_main_event(
            ChatEventInternal::PermissionsChanged(Box::new(PermissionsChanged {
                old_permissions,
                new_permissions,
                changed_by: my_user_id,
            })),
            args.correlation_id,
            runtime_state.env.now(),
        );
    }

    if let Some(new_events_ttl) = args.events_ttl.expand() {
        if new_events_ttl != runtime_state.data.chat.events.get_events_time_to_live().value {
            runtime_state
                .data
                .chat
                .events
                .set_events_time_to_live(my_user_id, new_events_ttl, now);
        }
    }

    if let Some(gate) = args.gate.expand() {
        if runtime_state.data.chat.gate.value != gate {
            runtime_state.data.chat.gate = Timestamped::new(gate.clone(), now);

            runtime_state.data.chat.events.push_main_event(
                ChatEventInternal::GroupGateUpdated(Box::new(GroupGateUpdated {
                    updated_by: my_user_id,
                    new_gate: gate,
                })),
                args.correlation_id,
                runtime_state.env.now(),
            );
        }
    }

    handle_activity_notification(runtime_state);
}

fn merge_permissions(new: OptionalGroupPermissions, old: &GroupPermissions) -> GroupPermissions {
    GroupPermissions {
        change_permissions: new.change_permissions.unwrap_or(old.change_permissions),
        change_roles: new.change_roles.unwrap_or(old.change_roles),
        add_members: GroupPermissionRole::Owner,
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
