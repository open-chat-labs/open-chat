use crate::activity_notifications::handle_activity_notification;
use crate::model::events::CommunityEventInternal;
use crate::{RuntimeState, execute_update_async, jobs, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::GroupGateUpdatedInternal;
use community_canister::update_community::{Response::*, *};
use group_index_canister::{c2c_make_community_private, c2c_update_community};
use oc_error_codes::OCErrorCode;
use tracing::error;
use types::{
    AccessGateConfigInternal, AvatarChanged, BannerChanged, CanisterId, CommunityId, CommunityPermissions,
    CommunityPermissionsChanged, CommunityVisibilityChanged, Document, GroupDescriptionChanged, GroupNameChanged,
    GroupRulesChanged, OCResult, OptionUpdate, OptionalCommunityPermissions, PrimaryLanguageChanged, Timestamped, UserId,
};
use utils::document::{validate_avatar, validate_banner};
use utils::text_validation::{
    NameValidationError, RulesValidationError, validate_community_name, validate_description, validate_rules,
};

#[update(msgpack = true)]
#[trace]
async fn update_community(args: Args) -> Response {
    execute_update_async(|| update_community_impl(args)).await
}

async fn update_community_impl(mut args: Args) -> Response {
    clean_args(&mut args);

    let prepare_result = match read_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(error) => return Error(error),
    };

    let group_index_canister_id = prepare_result.group_index_canister_id;

    if args.public == Some(false) {
        let c2c_make_community_private_args = c2c_make_community_private::Args {};

        match group_index_canister_c2c_client::c2c_make_community_private(
            group_index_canister_id,
            &c2c_make_community_private_args,
        )
        .await
        {
            Ok(response) => match response {
                c2c_make_community_private::Response::CommunityNotFound => {
                    error!(chat_id = %prepare_result.community_id, "Community not found in index");
                    return Error(OCErrorCode::Impossible.with_message("Community not found in index"));
                }
                c2c_make_community_private::Response::Error(error) => {
                    error!(chat_id = %prepare_result.community_id, "Error updating community: {error:?}");
                    return Error(error);
                }
                c2c_make_community_private::Response::Success => {}
            },
            Err(error) => return Error(error.into()),
        }
    } else if prepare_result.is_public
        && (args.name.is_some()
            || args.description.is_some()
            || args.avatar.has_update()
            || args.banner.has_update()
            || args.gate_config.has_update()
            || args.public == Some(true)
            || args.primary_language.is_some())
    {
        let c2c_update_community_args = c2c_update_community::Args {
            name: prepare_result.name,
            description: prepare_result.description,
            avatar_id: prepare_result.avatar_id,
            banner_id: prepare_result.banner_id,
            gate_config: prepare_result.gate_config.map(|gc| gc.into()),
            primary_language: prepare_result.primary_language,
            channel_count: prepare_result.channel_count,
        };

        match group_index_canister_c2c_client::c2c_update_community(group_index_canister_id, &c2c_update_community_args).await {
            Ok(response) => match response {
                c2c_update_community::Response::Success => {}
                c2c_update_community::Response::NameTaken => return Error(OCErrorCode::NameTaken.into()),
                c2c_update_community::Response::CommunityNotFound => {
                    error!(chat_id = %prepare_result.community_id, "Community not found in index");
                    return Error(OCErrorCode::Impossible.with_message("Community not found in index"));
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
    community_id: CommunityId,
    name: String,
    description: String,
    avatar_id: Option<u128>,
    banner_id: Option<u128>,
    gate_config: Option<AccessGateConfigInternal>,
    primary_language: String,
    channel_count: u32,
}

fn prepare(args: &Args, state: &RuntimeState) -> OCResult<PrepareResult> {
    state.data.verify_not_frozen()?;

    let member = state.get_calling_member(true)?;

    let permissions = &state.data.permissions;
    if !member.role().can_update_details(permissions)
        || (args.permissions.is_some() && !member.role().can_change_permissions())
        || (args.public.is_some() && !member.role().can_change_community_visibility())
    {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    if let OptionUpdate::SetToSome(gate_config) = &args.gate_config
        && !gate_config.validate(state.data.test_mode)
    {
        return Err(OCErrorCode::InvalidAccessGate.into());
    }

    let avatar_update = args.avatar.as_ref().expand();
    let banner_update = args.banner.as_ref().expand();
    let gate_config = args
        .gate_config
        .clone()
        .map(|gc| gc.into())
        .apply_to(state.data.gate_config.value.clone());

    if let Some(name) = &args.name
        && let Err(error) = validate_community_name(name, state.data.is_public.value)
    {
        return Err(match error {
            NameValidationError::TooShort(s) => OCErrorCode::NameTooShort.with_json(&s),
            NameValidationError::TooLong(l) => OCErrorCode::NameTooLong.with_json(&l),
            NameValidationError::Reserved => OCErrorCode::NameReserved.into(),
        });
    }

    if let Some(description) = &args.description
        && let Err(error) = validate_description(description)
    {
        return Err(OCErrorCode::DescriptionTooLong.with_json(&error));
    }

    if let Some(rules) = &args.rules
        && let Err(error) = validate_rules(rules.enabled, &rules.text)
    {
        return Err(match error {
            RulesValidationError::TooShort(s) => OCErrorCode::RulesTooShort.with_json(&s),
            RulesValidationError::TooLong(l) => OCErrorCode::RulesTooLong.with_json(&l),
        });
    }

    if let Err(error) = avatar_update.map_or(Ok(()), validate_avatar) {
        return Err(OCErrorCode::AvatarTooBig.with_json(&error));
    }

    if let Err(error) = banner_update.map_or(Ok(()), validate_banner) {
        return Err(OCErrorCode::BannerTooBig.with_json(&error));
    }

    if let Some(lang) = &args.primary_language
        && lang.len() != 2
    {
        return Err(OCErrorCode::InvalidLanguage.into());
    }

    Ok(PrepareResult {
        my_user_id: member.user_id,
        group_index_canister_id: state.data.group_index_canister_id,
        is_public: args.public.unwrap_or(state.data.is_public.value),
        community_id: state.env.canister_id().into(),
        name: args.name.as_ref().unwrap_or(&state.data.name).clone(),
        description: args.description.as_ref().unwrap_or(&state.data.description).clone(),
        avatar_id: avatar_update.map_or(Document::id(&state.data.avatar), |avatar| avatar.map(|a| a.id)),
        banner_id: banner_update.map_or(Document::id(&state.data.banner), |banner| banner.map(|a| a.id)),
        gate_config,
        primary_language: args.primary_language.as_ref().unwrap_or(&state.data.primary_language).clone(),
        channel_count: state.data.channels.public_channel_ids().len() as u32,
    })
}

fn commit(my_user_id: UserId, args: Args, state: &mut RuntimeState) -> SuccessResult {
    let mut result = SuccessResult { rules_version: None };

    let now = state.env.now();

    // If a verified community changes its name or becomes private it loses it's verified status
    if state.data.verified.value {
        let mut revoke = false;

        if let Some(new_name) = args.name.as_ref()
            && !new_name.eq_ignore_ascii_case(&state.data.name.value)
        {
            revoke = true;
        }

        if let Some(new_public) = args.public
            && (new_public != state.data.is_public.value)
            && !new_public
        {
            revoke = true;
        }

        if revoke {
            state.data.verified = Timestamped::new(false, now);
        }
    }

    if let Some(name) = args.name
        && state.data.name.value != name
    {
        state.push_community_event(CommunityEventInternal::NameChanged(Box::new(GroupNameChanged {
            new_name: name.clone(),
            previous_name: state.data.name.value.clone(),
            changed_by: my_user_id,
        })));

        state.data.name = Timestamped::new(name, now);
    }

    if let Some(description) = args.description
        && state.data.description.value != description
    {
        state.push_community_event(CommunityEventInternal::DescriptionChanged(Box::new(
            GroupDescriptionChanged {
                new_description: description.clone(),
                previous_description: state.data.description.value.clone(),
                changed_by: my_user_id,
            },
        )));

        state.data.description = Timestamped::new(description, now);
    }

    if let Some(new_rules) = args.rules {
        let enabled = new_rules.enabled;
        let prev_enabled = state.data.rules.enabled;

        if state.data.rules.update(
            |r| {
                if let Some(rules_version) = r.update(new_rules, now) {
                    result.rules_version = Some(rules_version);
                    state.data.members.mark_rules_accepted(&my_user_id, rules_version, now);
                    true
                } else {
                    false
                }
            },
            now,
        ) {
            state.push_community_event(CommunityEventInternal::RulesChanged(Box::new(GroupRulesChanged {
                enabled,
                prev_enabled,
                changed_by: my_user_id,
            })));
        }
    }

    if let Some(avatar) = args.avatar.expand() {
        let previous_avatar_id = Document::id(&state.data.avatar.value);
        let new_avatar_id = Document::id(&avatar);

        if new_avatar_id != previous_avatar_id {
            state.push_community_event(CommunityEventInternal::AvatarChanged(Box::new(AvatarChanged {
                new_avatar: new_avatar_id,
                previous_avatar: previous_avatar_id,
                changed_by: my_user_id,
            })));

            state.data.avatar = Timestamped::new(avatar, now);
        }
    }

    if let Some(banner) = args.banner.expand() {
        let previous_banner_id = Document::id(&state.data.banner.value);
        let new_banner_id = Document::id(&banner);

        if new_banner_id != previous_banner_id {
            state.push_community_event(CommunityEventInternal::BannerChanged(Box::new(BannerChanged {
                new_banner: new_banner_id,
                previous_banner: previous_banner_id,
                changed_by: my_user_id,
            })));

            state.data.banner = Timestamped::new(banner, now);
        }
    }

    if let Some(permissions) = args.permissions {
        let old_permissions = state.data.permissions.value.clone();
        let new_permissions = merge_permissions(permissions, &old_permissions);
        state.data.permissions = Timestamped::new(new_permissions.clone(), now);

        state.push_community_event(CommunityEventInternal::PermissionsChanged(Box::new(
            CommunityPermissionsChanged {
                old_permissions,
                new_permissions,
                changed_by: my_user_id,
            },
        )));
    }

    if let Some(gate_config) = args.gate_config.clone().map(|g| g.into()).expand()
        && state.data.gate_config.value != gate_config
    {
        let prev_gate_config = state.data.gate_config.clone();

        state.data.gate_config = Timestamped::new(gate_config.clone(), now);

        state.data.update_member_expiry(None, &prev_gate_config, now);

        state.push_community_event(CommunityEventInternal::GateUpdated(Box::new(GroupGateUpdatedInternal {
            updated_by: my_user_id,
            new_gate_config: gate_config,
        })));
    }

    if let Some(public) = args.public
        && state.data.is_public.value != public
    {
        state.data.is_public = Timestamped::new(public, now);

        let event = CommunityVisibilityChanged {
            now_public: public,
            changed_by: my_user_id,
        };

        state.push_community_event(CommunityEventInternal::VisibilityChanged(Box::new(event)));
    }
    if let Some(new) = args.primary_language {
        let previous = state.data.primary_language.value.clone();

        if previous != new {
            state.data.primary_language = Timestamped::new(new.clone(), now);

            let event = PrimaryLanguageChanged {
                previous,
                new,
                changed_by: my_user_id,
            };

            state.push_community_event(CommunityEventInternal::PrimaryLanguageChanged(Box::new(event)));
        }
    }

    jobs::expire_members::restart_job(state);

    handle_activity_notification(state);
    result
}

fn merge_permissions(new: OptionalCommunityPermissions, old: &CommunityPermissions) -> CommunityPermissions {
    CommunityPermissions {
        change_roles: new.change_roles.unwrap_or(old.change_roles),
        invite_users: new.invite_users.unwrap_or(old.invite_users),
        remove_members: new.remove_members.unwrap_or(old.remove_members),
        update_details: new.update_details.unwrap_or(old.update_details),
        create_public_channel: new.create_public_channel.unwrap_or(old.create_public_channel),
        create_private_channel: new.create_private_channel.unwrap_or(old.create_private_channel),
        manage_user_groups: new.manage_user_groups.unwrap_or(old.manage_user_groups),
    }
}
