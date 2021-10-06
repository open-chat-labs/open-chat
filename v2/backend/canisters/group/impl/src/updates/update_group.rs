use crate::updates::handle_activity_notification;
use crate::updates::update_group::Response::*;
use crate::{RuntimeState, RUNTIME_STATE};
use chat_events::ChatEventInternal;
use cycles_utils::check_cycles_balance;
use group_canister::update_group::*;
use group_canister::{MAX_GROUP_DESCRIPTION_LENGTH, MAX_GROUP_NAME_LENGTH};
use group_index_canister::c2c_update_group;
use ic_cdk_macros::update;
use log::error;
use types::{
    Avatar, AvatarChanged, CanisterId, ChatId, FieldTooLongResult, GroupDescriptionChanged, GroupNameChanged, UserId,
    MAX_AVATAR_SIZE,
};

#[update]
async fn update_group(args: Args) -> Response {
    check_cycles_balance();

    let prepare_result = match RUNTIME_STATE.with(|state| prepare(&args, state.borrow().as_ref().unwrap())) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    if prepare_result.is_public {
        let c2c_update_group_args = c2c_update_group::Args {
            name: args.name.clone(),
            description: args.description.clone(),
            avatar_id: Avatar::id(&args.avatar),
        };

        match group_index_canister_c2c_client::c2c_update_group(prepare_result.group_index_canister_id, &c2c_update_group_args)
            .await
        {
            Ok(response) => match response {
                c2c_update_group::Response::NameTaken => return NameTaken,
                c2c_update_group::Response::ChatNotFound => {
                    error!("Group not found in index: {:?}", prepare_result.chat_id);
                    return InternalError;
                }
                c2c_update_group::Response::Success => (),
            },
            Err(error) => {
                error!("Error calling update group: {:?}", error);
                return InternalError;
            }
        };
    }

    RUNTIME_STATE.with(|state| commit(prepare_result.my_user_id, args, state.borrow_mut().as_mut().unwrap()));
    Success
}

struct PrepareResult {
    my_user_id: UserId,
    group_index_canister_id: CanisterId,
    is_public: bool,
    chat_id: ChatId,
}

fn prepare(args: &Args, runtime_state: &RuntimeState) -> Result<PrepareResult, Response> {
    let caller = runtime_state.env.caller();
    if args.name.len() > MAX_GROUP_NAME_LENGTH as usize {
        Err(NameTooLong(FieldTooLongResult {
            length_provided: args.name.len() as u32,
            max_length: MAX_GROUP_NAME_LENGTH,
        }))
    } else if args.description.len() > MAX_GROUP_DESCRIPTION_LENGTH as usize {
        Err(DescriptionTooLong(FieldTooLongResult {
            length_provided: args.description.len() as u32,
            max_length: MAX_GROUP_DESCRIPTION_LENGTH,
        }))
    } else if args
        .avatar
        .as_ref()
        .map_or(false, |a| a.data.len() > MAX_AVATAR_SIZE as usize)
    {
        Err(AvatarTooBig(FieldTooLongResult {
            length_provided: args.avatar.as_ref().unwrap().data.len() as u32,
            max_length: MAX_AVATAR_SIZE as u32,
        }))
    } else if let Some(participant) = runtime_state.data.participants.get_by_principal(&caller) {
        if !participant.role.can_update_group() {
            Err(NotAuthorized)
        } else {
            Ok(PrepareResult {
                my_user_id: participant.user_id,
                group_index_canister_id: runtime_state.data.group_index_canister_id,
                is_public: runtime_state.data.is_public,
                chat_id: runtime_state.env.canister_id().into(),
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
        events.push_event(
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
        events.push_event(
            ChatEventInternal::GroupDescriptionChanged(Box::new(GroupDescriptionChanged {
                new_description: args.description.clone(),
                previous_description: runtime_state.data.description.clone(),
                changed_by: my_user_id,
            })),
            now,
        );

        runtime_state.data.description = args.description;
    }

    if let Some(avatar) = args.avatar {
        events.push_event(
            ChatEventInternal::AvatarChanged(Box::new(AvatarChanged {
                new_avatar: avatar.id,
                previous_avatar: Avatar::id(&runtime_state.data.avatar),
                changed_by: my_user_id,
            })),
            now,
        );

        runtime_state.data.avatar = Some(avatar);
    }

    handle_activity_notification(runtime_state);
}
