use crate::updates::handle_activity_notification;
use crate::updates::update_group::Response::*;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use group_canister::update_group::*;
use group_index_canister::{c2c_update_group, MAX_GROUP_DESCRIPTION_LENGTH, MAX_GROUP_NAME_LENGTH, MIN_GROUP_NAME_LENGTH};
use ic_cdk_macros::update;
use tracing::error;
use types::{
    Avatar, AvatarChanged, CanisterId, ChatId, FieldTooLongResult, FieldTooShortResult, GroupDescriptionChanged,
    GroupNameChanged, PermissionsChanged, UserId, MAX_AVATAR_SIZE,
};

#[update]
#[trace]
async fn update_group(mut args: Args) -> Response {
    run_regular_jobs();

    args.name = args.name.trim().to_string();
    args.description = args.description.trim().to_string();

    let prepare_result = match read_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    if prepare_result.is_public {
        let c2c_update_group_args = c2c_update_group::Args {
            name: args.name.clone(),
            description: args.description.clone(),
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

struct PrepareResult {
    my_user_id: UserId,
    group_index_canister_id: CanisterId,
    is_public: bool,
    chat_id: ChatId,
    avatar_id: Option<u128>,
}

fn prepare(args: &Args, runtime_state: &RuntimeState) -> Result<PrepareResult, Response> {
    let caller = runtime_state.env.caller();
    let avatar_update = args.avatar.as_ref().expand();
    let avatar_update_size = avatar_update.flatten().map_or(0, |a| a.data.len() as u32);

    if args.name.len() < MIN_GROUP_NAME_LENGTH as usize {
        Err(NameTooShort(FieldTooShortResult {
            length_provided: args.name.len() as u32,
            min_length: MIN_GROUP_NAME_LENGTH,
        }))
    } else if args.name.len() > MAX_GROUP_NAME_LENGTH as usize {
        Err(NameTooLong(FieldTooLongResult {
            length_provided: args.name.len() as u32,
            max_length: MAX_GROUP_NAME_LENGTH,
        }))
    } else if args.description.len() > MAX_GROUP_DESCRIPTION_LENGTH as usize {
        Err(DescriptionTooLong(FieldTooLongResult {
            length_provided: args.description.len() as u32,
            max_length: MAX_GROUP_DESCRIPTION_LENGTH,
        }))
    } else if avatar_update_size > MAX_AVATAR_SIZE {
        Err(AvatarTooBig(FieldTooLongResult {
            length_provided: avatar_update_size,
            max_length: MAX_AVATAR_SIZE,
        }))
    } else if let Some(participant) = runtime_state.data.participants.get_by_principal(&caller) {
        let permissions = &runtime_state.data.permissions;
        if !participant.role.can_update_group(permissions)
            || (args.permissions.is_some() && !participant.role.can_change_permissions(permissions))
        {
            Err(NotAuthorized)
        } else {
            Ok(PrepareResult {
                my_user_id: participant.user_id,
                group_index_canister_id: runtime_state.data.group_index_canister_id,
                is_public: runtime_state.data.is_public,
                chat_id: runtime_state.env.canister_id().into(),
                avatar_id: avatar_update.map_or(Avatar::id(&runtime_state.data.avatar), |avatar| avatar.map(|a| a.id)),
            })
        }
    } else {
        Err(CallerNotInGroup)
    }
}

fn commit(my_user_id: UserId, args: Args, runtime_state: &mut RuntimeState) {
    let now = runtime_state.env.now();
    let events = &mut runtime_state.data.events;

    if runtime_state.data.name != args.name {
        events.push_main_event(
            ChatEventInternal::GroupNameChanged(Box::new(GroupNameChanged {
                new_name: args.name.clone(),
                previous_name: runtime_state.data.name.clone(),
                changed_by: my_user_id,
            })),
            now,
        );

        runtime_state.data.name = args.name;
    }

    if runtime_state.data.description != args.description {
        events.push_main_event(
            ChatEventInternal::GroupDescriptionChanged(Box::new(GroupDescriptionChanged {
                new_description: args.description.clone(),
                previous_description: runtime_state.data.description.clone(),
                changed_by: my_user_id,
            })),
            now,
        );

        runtime_state.data.description = args.description;
    }

    if let Some(avatar) = args.avatar.expand() {
        let previous_avatar_id = Avatar::id(&runtime_state.data.avatar);
        let new_avatar_id = Avatar::id(&avatar);

        if new_avatar_id != previous_avatar_id {
            events.push_main_event(
                ChatEventInternal::AvatarChanged(Box::new(AvatarChanged {
                    new_avatar: new_avatar_id,
                    previous_avatar: previous_avatar_id,
                    changed_by: my_user_id,
                })),
                now,
            );

            runtime_state.data.avatar = avatar;
        }
    }

    if let Some(permissions) = args.permissions {
        events.push_main_event(
            ChatEventInternal::PermissionsChanged(Box::new(PermissionsChanged {
                old_permissions: runtime_state.data.permissions.clone(),
                new_permissions: permissions.clone(),
                changed_by: my_user_id,
            })),
            now,
        );

        runtime_state.data.permissions = permissions;
    }

    handle_activity_notification(runtime_state);
}
