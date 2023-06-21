use crate::activity_notifications::handle_activity_notification;
use crate::updates::update_group_v2::Response::*;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use group_canister::update_group_v2::*;
use group_chat_core::UpdateResult;
use group_index_canister::c2c_update_group;
use ic_cdk_macros::update;
use tracing::error;
use types::{AccessGate, CanisterId, ChatId, Document, UserId};

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
            gate: prepare_result.gate,
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
    gate: Option<AccessGate>,
}

fn prepare(args: &Args, state: &RuntimeState) -> Result<PrepareResult, Response> {
    if state.data.is_frozen() {
        return Err(ChatFrozen);
    }

    let caller = state.env.caller();
    let gate = args.gate.as_ref().apply_to(state.data.chat.gate.value.as_ref());

    if let Some(member) = state.data.get_member(caller) {
        match state.data.chat.can_update(
            &member.user_id,
            &args.name,
            &args.description,
            &args.rules,
            &args.avatar,
            &args.permissions,
        ) {
            UpdateResult::Success => {
                let avatar_update = args.avatar.as_ref().expand();

                Ok(PrepareResult {
                    my_user_id: member.user_id,
                    group_index_canister_id: state.data.group_index_canister_id,
                    is_public: state.data.chat.is_public,
                    chat_id: state.env.canister_id().into(),
                    name: args.name.as_ref().unwrap_or(&state.data.chat.name).clone(),
                    description: args.description.as_ref().unwrap_or(&state.data.chat.description).clone(),
                    avatar_id: avatar_update.map_or(Document::id(&state.data.chat.avatar), |avatar| avatar.map(|a| a.id)),
                    gate: gate.cloned(),
                })
            }
            UpdateResult::UserSuspended => Err(UserSuspended),
            UpdateResult::UserNotInGroup => Err(CallerNotInGroup),
            UpdateResult::NotAuthorized => Err(NotAuthorized),
            UpdateResult::NameTooShort(v) => Err(NameTooShort(v)),
            UpdateResult::NameTooLong(v) => Err(NameTooLong(v)),
            UpdateResult::NameReserved => Err(NameReserved),
            UpdateResult::DescriptionTooLong(v) => Err(DescriptionTooLong(v)),
            UpdateResult::RulesTooShort(v) => Err(RulesTooShort(v)),
            UpdateResult::RulesTooLong(v) => Err(RulesTooLong(v)),
            UpdateResult::AvatarTooBig(v) => Err(AvatarTooBig(v)),
            UpdateResult::NameTaken => Err(NameTaken),
        }
    } else {
        Err(CallerNotInGroup)
    }
}

fn commit(my_user_id: UserId, args: Args, state: &mut RuntimeState) {
    state.data.chat.do_update(
        my_user_id,
        args.name,
        args.description,
        args.rules,
        args.avatar,
        args.permissions,
        args.gate,
        args.events_ttl,
        state.env.now(),
    );

    handle_activity_notification(state);
}
