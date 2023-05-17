use crate::model::events::CommunityEvent;
use crate::{mutate_state, read_state, RuntimeState};
use canister_tracing_macros::trace;
use community_canister::update_community::{Response::*, *};
use group_index_canister::c2c_update_community;
use ic_cdk_macros::update;
use tracing::error;
use types::{
    Avatar, AvatarChanged, CanisterId, CommunityId, CommunityPermissions, CommunityPermissionsChanged, GroupDescriptionChanged,
    GroupGateUpdated, GroupNameChanged, GroupRulesChanged, OptionalCommunityPermissions, Timestamped, UserId,
};
use utils::avatar_validation::validate_avatar;
use utils::group_validation::{validate_description, validate_name, validate_rules, NameValidationError, RulesValidationError};

#[update]
#[trace]
async fn update_community(mut args: Args) -> Response {
    clean_args(&mut args);

    let prepare_result = match read_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    if prepare_result.is_public && (args.name.is_some() || args.description.is_some() || args.avatar.has_update()) {
        let c2c_update_group_args = c2c_update_community::Args {
            name: prepare_result.name,
            description: prepare_result.description,
            avatar_id: prepare_result.avatar_id,
        };

        let group_index_canister_id = prepare_result.group_index_canister_id;

        match group_index_canister_c2c_client::c2c_update_community(group_index_canister_id, &c2c_update_group_args).await {
            Ok(response) => match response {
                c2c_update_community::Response::Success => {}
                c2c_update_community::Response::NameTaken => return NameTaken,
                c2c_update_community::Response::CommunityNotFound => {
                    error!(chat_id = %prepare_result.ccommunity_id, "Community not found in index");
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
    ccommunity_id: CommunityId,
    name: String,
    description: String,
    avatar_id: Option<u128>,
}

fn prepare(args: &Args, state: &RuntimeState) -> Result<PrepareResult, Response> {
    if state.data.is_frozen() {
        return Err(CommunityFrozen);
    }

    let caller = state.env.caller();
    let avatar_update = args.avatar.as_ref().expand();

    if let Some(name) = &args.name {
        if let Err(error) = validate_name(name, state.data.is_public) {
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

    if let Err(error) = avatar_update.map_or(Ok(()), |a| validate_avatar(a)) {
        return Err(AvatarTooBig(error));
    }

    if let Some(member) = state.data.members.get(caller) {
        if member.suspended.value {
            return Err(UserSuspended);
        }

        let permissions = &state.data.permissions;
        if !member.role.can_update_details(permissions)
            || (args.permissions.is_some() && !member.role.can_change_permissions(permissions))
        {
            Err(NotAuthorized)
        } else {
            Ok(PrepareResult {
                my_user_id: member.user_id,
                group_index_canister_id: state.data.group_index_canister_id,
                is_public: state.data.is_public,
                ccommunity_id: state.env.canister_id().into(),
                name: args.name.as_ref().unwrap_or(&state.data.name).clone(),
                description: args.description.as_ref().unwrap_or(&state.data.description).clone(),
                avatar_id: avatar_update.map_or(Avatar::id(&state.data.avatar), |avatar| avatar.map(|a| a.id)),
            })
        }
    } else {
        Err(CallerNotInCommunity)
    }
}

fn commit(my_user_id: UserId, args: Args, state: &mut RuntimeState) {
    let now = state.env.now();
    let events = &mut state.data.events;

    if let Some(name) = args.name {
        if state.data.name != name {
            events.push_event(
                CommunityEvent::NameChanged(Box::new(GroupNameChanged {
                    new_name: name.clone(),
                    previous_name: state.data.name.clone(),
                    changed_by: my_user_id,
                })),
                now,
            );

            state.data.name = name;
        }
    }

    if let Some(description) = args.description {
        if state.data.description != description {
            events.push_event(
                CommunityEvent::DescriptionChanged(Box::new(GroupDescriptionChanged {
                    new_description: description.clone(),
                    previous_description: state.data.description.clone(),
                    changed_by: my_user_id,
                })),
                now,
            );

            state.data.description = description;
        }
    }

    if let Some(rules) = args.rules {
        if state.data.rules.enabled != rules.enabled || state.data.rules.text != rules.text {
            events.push_event(
                CommunityEvent::RulesChanged(Box::new(GroupRulesChanged {
                    enabled: rules.enabled,
                    prev_enabled: state.data.rules.enabled,
                    changed_by: my_user_id,
                })),
                now,
            );

            state.data.rules = rules;
        }
    }

    if let Some(avatar) = args.avatar.expand() {
        let previous_avatar_id = Avatar::id(&state.data.avatar);
        let new_avatar_id = Avatar::id(&avatar);

        if new_avatar_id != previous_avatar_id {
            events.push_event(
                CommunityEvent::AvatarChanged(Box::new(AvatarChanged {
                    new_avatar: new_avatar_id,
                    previous_avatar: previous_avatar_id,
                    changed_by: my_user_id,
                })),
                now,
            );

            state.data.avatar = avatar;
        }
    }

    if let Some(permissions) = args.permissions {
        let old_permissions = state.data.permissions.clone();
        let new_permissions = merge_permissions(permissions, &old_permissions);
        state.data.permissions = new_permissions.clone();

        state.data.events.push_event(
            CommunityEvent::PermissionsChanged(Box::new(CommunityPermissionsChanged {
                old_permissions,
                new_permissions,
                changed_by: my_user_id,
            })),
            state.env.now(),
        );
    }

    if let Some(gate) = args.gate.expand() {
        if state.data.gate.value != gate {
            state.data.gate = Timestamped::new(gate.clone(), now);

            state.data.events.push_event(
                CommunityEvent::GateUpdated(Box::new(GroupGateUpdated {
                    updated_by: my_user_id,
                    new_gate: gate,
                })),
                state.env.now(),
            );
        }
    }
}

fn merge_permissions(new: OptionalCommunityPermissions, old: &CommunityPermissions) -> CommunityPermissions {
    CommunityPermissions {
        change_permissions: new.change_permissions.unwrap_or(old.change_permissions),
        change_roles: new.change_roles.unwrap_or(old.change_roles),
        invite_users: new.invite_users.unwrap_or(old.invite_users),
        remove_members: new.remove_members.unwrap_or(old.remove_members),
        block_users: new.block_users.unwrap_or(old.block_users),
        update_details: new.update_details.unwrap_or(old.update_details),
        create_public_group: new.create_public_group.unwrap_or(old.create_public_group),
        create_private_group: new.create_private_group.unwrap_or(old.create_private_group),
    }
}
