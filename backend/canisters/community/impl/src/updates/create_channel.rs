use super::c2c_join_community::join_community_impl;
use crate::activity_notifications::handle_activity_notification;
use crate::guards::{caller_is_local_user_index, caller_is_proposals_bot};
use crate::model::channels::Channel;
use crate::timer_job_types::JoinMembersToPublicChannelJob;
use crate::{mutate_state, run_regular_jobs, CallerResult, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::create_channel::{Response::*, *};
use community_canister::{c2c_bot_create_channel, c2c_join_community};
use group_chat_core::GroupChatCore;
use rand::Rng;
use types::{BotCaller, BotPermissions, Caller, CommunityPermission, MultiUserChat, UserType};
use url::Url;
use utils::document::validate_avatar;
use utils::text_validation::{
    validate_channel_name, validate_description, validate_rules, RulesValidationError, StringLengthValidationError,
};

#[update(msgpack = true)]
#[trace]
fn create_channel(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| create_channel_impl(args, false, None, state))
}

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_bot_create_channel(args: c2c_bot_create_channel::Args) -> c2c_bot_create_channel::Response {
    run_regular_jobs();

    let bot_caller = BotCaller {
        bot: args.bot_id,
        initiator: args.initiator.clone(),
    };

    mutate_state(|state| create_channel_impl(args.into(), false, Some(bot_caller), state)).into()
}

#[update(guard = "caller_is_proposals_bot", msgpack = true)]
#[trace]
fn c2c_create_proposals_channel(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| {
        let caller = state.env.caller();

        if let Some(response) = join_community_impl(
            &c2c_join_community::Args {
                user_id: caller.into(),
                principal: caller,
                invite_code: None,
                referred_by: None,
                is_platform_moderator: false,
                user_type: UserType::OcControlledBot,
                diamond_membership_expires_at: None,
                verified_credential_args: None,
                unique_person_proof: None,
            },
            Vec::new(),
            state,
        )
        .err()
        {
            match response {
                c2c_join_community::Response::UserBlocked => return NotAuthorized,
                c2c_join_community::Response::AlreadyInCommunity(_) => {}
                _ => panic!("Unexpected response from c2c_join_community"),
            }
        }

        create_channel_impl(args, true, None, state)
    })
}

fn create_channel_impl(
    args: Args,
    is_proposals_channel: bool,
    bot_caller: Option<BotCaller>,
    state: &mut RuntimeState,
) -> Response {
    if state.data.is_frozen() {
        return CommunityFrozen;
    }

    if let Some(external_url) = &args.external_url {
        if Url::parse(external_url).is_err() {
            return ExternalUrlInvalid;
        }
    }

    let caller = match state.verified_caller(bot_caller) {
        CallerResult::Success(caller) => caller,
        CallerResult::NotFound => return NotAuthorized,
        CallerResult::Suspended => return UserSuspended,
        CallerResult::Lapsed => return UserLapsed,
    };

    let messages_visible_to_non_members =
        args.is_public && args.messages_visible_to_non_members.unwrap_or(args.gate_config.is_none());

    let channel_id = state.generate_channel_id();
    let subtype = is_proposals_channel.then_some(args.subtype).flatten();

    if !is_proposals_channel
        && !match &caller {
            Caller::BotV2(bot_caller) => state.data.is_bot_permitted(
                &bot_caller.bot,
                None,
                &bot_caller.initiator,
                BotPermissions::from_community_permission(if args.is_public {
                    CommunityPermission::CreatePublicChannel
                } else {
                    CommunityPermission::CreatePrivateChannel
                }),
            ),
            _ => {
                if let Some(member) = state.data.members.get_by_user_id(&caller.agent()) {
                    if args.is_public {
                        member.role().can_create_public_channel(&state.data.permissions)
                    } else {
                        member.role().can_create_private_channel(&state.data.permissions)
                    }
                } else {
                    false
                }
            }
        }
    {
        return NotAuthorized;
    }

    if let Err(error) = validate_channel_name(&args.name) {
        return match error {
            StringLengthValidationError::TooShort(s) => NameTooShort(s),
            StringLengthValidationError::TooLong(l) => NameTooLong(l),
        };
    }

    if let Err(error) = validate_description(&args.description) {
        return DescriptionTooLong(error);
    }

    if let Err(error) = validate_rules(args.rules.enabled, &args.rules.text) {
        return match error {
            RulesValidationError::TooShort(s) => RulesTooShort(s),
            RulesValidationError::TooLong(l) => RulesTooLong(l),
        };
    }

    if let Err(error) = validate_avatar(args.avatar.as_ref()) {
        return AvatarTooBig(error);
    }

    if args
        .gate_config
        .as_ref()
        .map(|g| !g.validate(state.data.test_mode))
        .unwrap_or_default()
    {
        return AccessGateInvalid;
    }

    if state.data.channels.is_name_taken(&args.name, None) {
        return NameTaken;
    }

    let now = state.env.now();
    let permissions = args.permissions_v2.unwrap_or_default();

    let chat = GroupChatCore::new(
        MultiUserChat::Channel(state.env.canister_id().into(), channel_id),
        caller.agent(),
        args.is_public,
        args.name,
        args.description,
        args.rules,
        subtype,
        args.avatar,
        args.history_visible_to_new_joiners,
        messages_visible_to_non_members,
        permissions,
        args.gate_config.clone().map(|gc| gc.into()),
        args.events_ttl,
        (&caller).into(),
        state.env.rng().gen(),
        args.external_url,
        now,
    );

    state.data.members.mark_member_joined_channel(caller.agent(), channel_id);

    state.data.channels.add(Channel {
        id: channel_id,
        chat,
        date_imported: None,
        bot_api_keys: Default::default(),
    });

    if args.is_public && args.gate_config.is_none() {
        JoinMembersToPublicChannelJob {
            channel_id,
            members: state.data.members.iter_member_ids().collect(),
        }
        .execute_with_state(state);
    }

    handle_activity_notification(state);
    Success(SuccessResult { channel_id })
}
