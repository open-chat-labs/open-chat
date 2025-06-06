use crate::activity_notifications::handle_activity_notification;
use crate::updates::update_group_v2::Response::*;
use crate::{Data, RuntimeState, execute_update_async, jobs, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::update_group_v2::*;
use group_community_common::{ExpiringMember, Members};
use group_index_canister::{c2c_make_private, c2c_update_group};
use oc_error_codes::OCErrorCode;
use tracing::error;
use types::{
    AccessGateConfigInternal, CanisterId, ChatId, Document, OCResult, OptionUpdate, TimestampMillis, Timestamped, UserId,
};

#[update(msgpack = true)]
#[trace]
async fn update_group_v2(args: Args) -> Response {
    execute_update_async(|| update_group_impl(args)).await
}

async fn update_group_impl(mut args: Args) -> Response {
    clean_args(&mut args);

    let prepare_result = match read_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return Error(response),
    };

    let group_index_canister_id = prepare_result.group_index_canister_id;

    if args.public == Some(false) {
        let c2c_make_private_args = c2c_make_private::Args {};

        match group_index_canister_c2c_client::c2c_make_private(group_index_canister_id, &c2c_make_private_args).await {
            Ok(response) => match response {
                c2c_make_private::Response::ChatNotFound => {
                    error!(chat_id = %prepare_result.chat_id, "Group not found in index");
                    return Error(OCErrorCode::Impossible.with_message("Group not found in index"));
                }
                c2c_make_private::Response::Error(error) => {
                    error!("Failed to make group private: {error:?}");
                    return Error(error);
                }
                c2c_make_private::Response::Success => {}
            },
            Err(error) => return Error(error.into()),
        }
    } else if prepare_result.is_public
        && (args.name.is_some()
            || args.description.is_some()
            || args.avatar.has_update()
            || args.public == Some(true)
            || args.gate_config.has_update())
    {
        let c2c_update_group_args = c2c_update_group::Args {
            name: prepare_result.name,
            description: prepare_result.description,
            avatar_id: prepare_result.avatar_id,
            gate_config: prepare_result.gate_config.map(|gc| gc.into()),
        };

        match group_index_canister_c2c_client::c2c_update_group(group_index_canister_id, &c2c_update_group_args).await {
            Ok(response) => match response {
                c2c_update_group::Response::Success => {}
                c2c_update_group::Response::NameTaken => return Error(OCErrorCode::NameTaken.into()),
                c2c_update_group::Response::ChatNotFound => {
                    error!(chat_id = %prepare_result.chat_id, "Group not found in index");
                    return Error(OCErrorCode::Impossible.with_message("Group not found in index"));
                }
            },
            Err(error) => return Error(error.into()),
        };
    }

    SuccessV2(mutate_state(|state| commit(prepare_result.my_user_id, args, state)))
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
    gate_config: Option<AccessGateConfigInternal>,
}

fn prepare(args: &Args, state: &RuntimeState) -> OCResult<PrepareResult> {
    state.data.verify_not_frozen()?;

    if let OptionUpdate::SetToSome(gate_config) = &args.gate_config {
        if !gate_config.validate(state.data.test_mode) {
            return Err(OCErrorCode::InvalidAccessGate.into());
        }
    }

    let gate_config = args
        .gate_config
        .clone()
        .map(|gcu| gcu.into())
        .apply_to(state.data.chat.gate_config.value.clone());

    let member = state.get_calling_member(true)?;
    let permissions = args.permissions_v2.as_ref();

    state.data.chat.can_update(
        member.user_id(),
        &args.name,
        &args.description,
        &args.rules,
        &args.avatar,
        permissions,
        &args.public,
    )?;

    let avatar_update = args.avatar.as_ref().expand();

    Ok(PrepareResult {
        my_user_id: member.user_id(),
        group_index_canister_id: state.data.group_index_canister_id,
        is_public: args.public.unwrap_or(state.data.chat.is_public.value),
        chat_id: state.env.canister_id().into(),
        name: args.name.as_ref().unwrap_or(&state.data.chat.name).clone(),
        description: args.description.as_ref().unwrap_or(&state.data.chat.description).clone(),
        avatar_id: avatar_update.map_or(Document::id(&state.data.chat.avatar), |avatar| avatar.map(|a| a.id)),
        gate_config,
    })
}

fn commit(my_user_id: UserId, args: Args, state: &mut RuntimeState) -> SuccessResult {
    let prev_gate_config = state.data.chat.gate_config.value.clone();
    let now = state.env.now();

    // If a verified group changes its name or becomes private it loses it's verified status
    if state.data.verified.value {
        let mut revoke = false;

        if let Some(new_name) = args.name.as_ref() {
            if !new_name.eq_ignore_ascii_case(&state.data.chat.name.value) {
                revoke = true;
            }
        }

        if let Some(new_public) = args.public {
            if (new_public != state.data.chat.is_public.value) && !new_public {
                revoke = true;
            }
        }

        if revoke {
            state.data.verified = Timestamped::new(false, now);
        }
    }

    let result = state.data.chat.do_update(
        my_user_id,
        args.name,
        args.description,
        args.rules,
        args.avatar,
        args.permissions_v2,
        args.gate_config.map(|g| g.into()),
        args.public,
        args.messages_visible_to_non_members,
        args.events_ttl,
        OptionUpdate::NoChange,
        now,
    );

    if result.gate_config_update.has_update() {
        update_member_expiry(&mut state.data, &prev_gate_config, now);
    }

    jobs::expire_members::restart_job(state);

    state.push_bot_notifications(result.bot_notifications);
    handle_activity_notification(state);
    SuccessResult {
        rules_version: result.rules_version,
    }
}

pub fn update_member_expiry(data: &mut Data, prev_gate_config: &Option<AccessGateConfigInternal>, now: TimestampMillis) {
    let prev_gate_expiry = prev_gate_config.as_ref().and_then(|gc| gc.expiry());
    let new_gate_config = data.chat.gate_config.value.as_ref();
    let new_gate_expiry = new_gate_config.and_then(|gc| gc.expiry());

    if let Some(prev_gate_expiry) = prev_gate_expiry {
        if let Some(new_gate_expiry) = new_gate_expiry {
            // If there is also a new expiring gate then update the expiry schedule of members if necessary
            data.expiring_members
                .change_gate_expiry(None, new_gate_expiry as i64 - prev_gate_expiry as i64);
        } else {
            // Remove the expiring members altogether
            data.expiring_members.remove_gate(None);
            data.expiring_member_actions.remove_gate(None);

            // If the access gate has been removed then clear lapsed status of members
            if new_gate_config.is_none() {
                data.chat.members.unlapse_all(now);
            }
        }
    } else if let Some(new_gate_expiry) = new_gate_expiry {
        // Else if the new gate has an expiry then add members to the expiry schedule.
        for user_id in data.chat.members.iter_members_who_can_lapse() {
            data.expiring_members.push(ExpiringMember {
                expires: now + new_gate_expiry,
                channel_id: None,
                user_id,
            });
        }
    }
}
