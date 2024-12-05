use crate::activity_notifications::handle_activity_notification;
use crate::model::events::CommunityEventInternal;
use crate::{jobs, mutate_state, read_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::GroupGateUpdatedInternal;
use community_canister::update_community::{Response::*, *};
use group_index_canister::{c2c_make_community_private, c2c_update_community};
use tracing::error;
use types::{
    AccessGateConfigInternal, AvatarChanged, BannerChanged, CanisterId, CommunityId, CommunityPermissions,
    CommunityPermissionsChanged, CommunityVisibilityChanged, Document, GroupDescriptionChanged, GroupNameChanged,
    GroupRulesChanged, OptionUpdate, OptionalCommunityPermissions, PrimaryLanguageChanged, Timestamped, UserId,
};
use utils::document::{validate_avatar, validate_banner};
use utils::text_validation::{
    validate_community_name, validate_description, validate_rules, NameValidationError, RulesValidationError,
};

#[update(msgpack = true)]
#[trace]
async fn update_community(mut args: Args) -> Response {
    run_regular_jobs();

    clean_args(&mut args);

    let prepare_result = match read_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
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
                    return InternalError;
                }
                c2c_make_community_private::Response::Success => {}
            },
            Err(_) => return InternalError,
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
                c2c_update_community::Response::NameTaken => return NameTaken,
                c2c_update_community::Response::CommunityNotFound => {
                    error!(chat_id = %prepare_result.community_id, "Community not found in index");
                    return InternalError;
                }
            },
            Err(_) => return InternalError,
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

fn prepare(args: &Args, state: &RuntimeState) -> Result<PrepareResult, Response> {
    if state.data.is_frozen() {
        return Err(CommunityFrozen);
    }

    if let OptionUpdate::SetToSome(gate_config) = &args.gate_config {
        if !gate_config.validate(state.data.test_mode) {
            return Err(AccessGateInvalid);
        }
    }

    let caller = state.env.caller();
    let avatar_update = args.avatar.as_ref().expand();
    let banner_update = args.banner.as_ref().expand();
    let gate_config = args
        .gate_config
        .clone()
        .map(|gc| gc.into())
        .apply_to(state.data.gate_config.value.clone());

    if let Some(name) = &args.name {
        if let Err(error) = validate_community_name(name, state.data.is_public) {
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

    if let Err(error) = banner_update.map_or(Ok(()), validate_banner) {
        return Err(BannerTooBig(error));
    }

    if let Some(lang) = &args.primary_language {
        if lang.len() != 2 {
            return Err(InvalidLanguage);
        }
    }

    if let Some(member) = state.data.members.get(caller) {
        if member.suspended().value {
            return Err(UserSuspended);
        } else if member.lapsed().value {
            return Err(UserLapsed);
        }

        let permissions = &state.data.permissions;
        if !member.role().can_update_details(permissions)
            || (args.permissions.is_some() && !member.role().can_change_permissions())
            || (args.public.is_some() && !member.role().can_change_community_visibility())
        {
            Err(NotAuthorized)
        } else {
            Ok(PrepareResult {
                my_user_id: member.user_id,
                group_index_canister_id: state.data.group_index_canister_id,
                is_public: args.public.unwrap_or(state.data.is_public),
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
    } else {
        Err(UserNotInCommunity)
    }
}

fn commit(my_user_id: UserId, args: Args, state: &mut RuntimeState) -> SuccessResult {
    let mut result = SuccessResult { rules_version: None };

    let now = state.env.now();
    let events = &mut state.data.events;

    if let Some(name) = args.name {
        if state.data.name != name {
            events.push_event(
                CommunityEventInternal::NameChanged(Box::new(GroupNameChanged {
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
                CommunityEventInternal::DescriptionChanged(Box::new(GroupDescriptionChanged {
                    new_description: description.clone(),
                    previous_description: state.data.description.clone(),
                    changed_by: my_user_id,
                })),
                now,
            );

            state.data.description = description;
        }
    }

    if let Some(new_rules) = args.rules {
        let enabled = new_rules.enabled;
        let prev_enabled = state.data.rules.enabled;

        if let Some(rules_version) = state.data.rules.update(new_rules, now) {
            result.rules_version = Some(rules_version);
            state.data.members.mark_rules_accepted(&my_user_id, rules_version, now);

            events.push_event(
                CommunityEventInternal::RulesChanged(Box::new(GroupRulesChanged {
                    enabled,
                    prev_enabled,
                    changed_by: my_user_id,
                })),
                now,
            );
        }
    }

    if let Some(avatar) = args.avatar.expand() {
        let previous_avatar_id = Document::id(&state.data.avatar);
        let new_avatar_id = Document::id(&avatar);

        if new_avatar_id != previous_avatar_id {
            events.push_event(
                CommunityEventInternal::AvatarChanged(Box::new(AvatarChanged {
                    new_avatar: new_avatar_id,
                    previous_avatar: previous_avatar_id,
                    changed_by: my_user_id,
                })),
                now,
            );

            state.data.avatar = avatar;
        }
    }

    if let Some(banner) = args.banner.expand() {
        let previous_banner_id = Document::id(&state.data.banner);
        let new_banner_id = Document::id(&banner);

        if new_banner_id != previous_banner_id {
            events.push_event(
                CommunityEventInternal::BannerChanged(Box::new(BannerChanged {
                    new_banner: new_banner_id,
                    previous_banner: previous_banner_id,
                    changed_by: my_user_id,
                })),
                now,
            );

            state.data.banner = banner;
        }
    }

    if let Some(permissions) = args.permissions {
        let old_permissions = state.data.permissions.clone();
        let new_permissions = merge_permissions(permissions, &old_permissions);
        state.data.permissions = new_permissions.clone();

        state.data.events.push_event(
            CommunityEventInternal::PermissionsChanged(Box::new(CommunityPermissionsChanged {
                old_permissions,
                new_permissions,
                changed_by: my_user_id,
            })),
            state.env.now(),
        );
    }

    if let Some(gate_config) = args.gate_config.clone().map(|g| g.into()).expand() {
        if state.data.gate_config.value != gate_config {
            let prev_gate_config = state.data.gate_config.clone();

            state.data.gate_config = Timestamped::new(gate_config.clone(), now);

            state.data.update_member_expiry(None, &prev_gate_config, now);

            state.data.events.push_event(
                CommunityEventInternal::GateUpdated(Box::new(GroupGateUpdatedInternal {
                    updated_by: my_user_id,
                    new_gate_config: gate_config,
                })),
                state.env.now(),
            );
        }
    }

    if let Some(public) = args.public {
        if state.data.is_public != public {
            state.data.is_public = public;

            let event = CommunityVisibilityChanged {
                now_public: public,
                changed_by: my_user_id,
            };

            state
                .data
                .events
                .push_event(CommunityEventInternal::VisibilityChanged(Box::new(event)), now);
        }
    }
    if let Some(new) = args.primary_language {
        let previous = state.data.primary_language.clone();

        if previous != new {
            state.data.primary_language.clone_from(&new);

            let event = PrimaryLanguageChanged {
                previous,
                new,
                changed_by: my_user_id,
            };

            state
                .data
                .events
                .push_event(CommunityEventInternal::PrimaryLanguageChanged(Box::new(event)), now);
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
