use crate::activity_notifications::handle_activity_notification;
use crate::updates::update_group_v2::Response::*;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use group_canister::update_group_v2::*;
use group_chat_core::CanUpdateResult;
use group_index_canister::c2c_update_group;
use ic_cdk_macros::update;
use tracing::error;
use types::{Avatar, CanisterId, ChatId, UserId};

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

fn prepare(args: &Args, state: &RuntimeState) -> Result<PrepareResult, Response> {
    if state.data.is_frozen() {
        return Err(ChatFrozen);
    }

    let caller = state.env.caller();

    if let Some(member) = state.data.get_member(caller) {
        match state.data.chat.can_update(
            &member.user_id,
            &args.name,
            &args.description,
            &args.rules,
            &args.avatar,
            &args.permissions,
        ) {
            CanUpdateResult::Success => {
                let avatar_update = args.avatar.as_ref().expand();

                Ok(PrepareResult {
                    my_user_id: member.user_id,
                    group_index_canister_id: state.data.group_index_canister_id,
                    is_public: state.data.chat.is_public,
                    chat_id: state.env.canister_id().into(),
                    name: args.name.as_ref().unwrap_or(&state.data.chat.name).clone(),
                    description: args.description.as_ref().unwrap_or(&state.data.chat.description).clone(),
                    avatar_id: avatar_update.map_or(Avatar::id(&state.data.chat.avatar), |avatar| avatar.map(|a| a.id)),
                })
            }
            CanUpdateResult::UserSuspended => Err(UserSuspended),
            CanUpdateResult::UserNotInGroup => Err(CallerNotInGroup),
            CanUpdateResult::NotAuthorized => Err(NotAuthorized),
            CanUpdateResult::NameTooShort(v) => Err(NameTooShort(v)),
            CanUpdateResult::NameTooLong(v) => Err(NameTooLong(v)),
            CanUpdateResult::NameReserved => Err(NameReserved),
            CanUpdateResult::DescriptionTooLong(v) => Err(DescriptionTooLong(v)),
            CanUpdateResult::RulesTooShort(v) => Err(RulesTooShort(v)),
            CanUpdateResult::RulesTooLong(v) => Err(RulesTooLong(v)),
            CanUpdateResult::AvatarTooBig(v) => Err(AvatarTooBig(v)),
            CanUpdateResult::NameTaken => Err(NameTaken),
        }
    } else {
        Err(CallerNotInGroup)
    }
}

fn commit(my_user_id: UserId, args: Args, runtime_state: &mut RuntimeState) {
    runtime_state.data.chat.do_update(
        my_user_id,
        args.name,
        args.description,
        args.rules,
        args.avatar,
        args.permissions,
        args.gate,
        args.events_ttl,
        runtime_state.env.now(),
    );

    handle_activity_notification(runtime_state);
}
