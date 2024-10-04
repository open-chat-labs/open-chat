use super::c2c_join_community::join_community_impl;
use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_proposals_bot;
use crate::model::channels::Channel;
use crate::updates::c2c_join_channel::add_members_to_public_channel_unchecked;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::c2c_join_community;
use community_canister::create_channel::{Response::*, *};
use group_chat_core::GroupChatCore;
use rand::Rng;
use std::collections::HashMap;
use types::{AccessGate, MultiUserChat, TimestampMillis, UserId, UserType};
use url::Url;
use utils::document_validation::validate_avatar;
use utils::text_validation::{
    validate_description, validate_group_name, validate_rules, NameValidationError, RulesValidationError,
};

#[update(candid = true, msgpack = true)]
#[trace]
async fn create_channel(args: Args) -> Response {
    run_regular_jobs();

    let diamond_membership_expiry_dates: HashMap<_, _> = match get_diamond_membership_expiry_dates_if_needed(&args).await {
        Ok(expiry_dates) => expiry_dates,
        Err(response) => return response,
    };

    mutate_state(|state| create_channel_impl(args, false, diamond_membership_expiry_dates, state))
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
                is_bot: true,
                user_type: UserType::OcControlledBot,
                diamond_membership_expires_at: None,
                verified_credential_args: None,
                unique_person_proof: None,
            },
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

        create_channel_impl(args, true, HashMap::new(), state)
    })
}

fn create_channel_impl(
    args: Args,
    is_proposals_channel: bool,
    diamond_membership_expiry_dates: HashMap<UserId, TimestampMillis>,
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

    let messages_visible_to_non_members = args.is_public && args.messages_visible_to_non_members.unwrap_or(args.gate.is_none());

    let caller = state.env.caller();
    let channel_id = state.generate_channel_id();
    if let Some(member) = state.data.members.get_mut(caller) {
        if member.suspended.value {
            return UserSuspended;
        }

        let subtype = is_proposals_channel.then_some(args.subtype).flatten();

        if !is_proposals_channel {
            let is_authorized = if args.is_public {
                member.role.can_create_public_channel(&state.data.permissions)
            } else {
                member.role.can_create_private_channel(&state.data.permissions)
            };

            if !is_authorized {
                return NotAuthorized;
            } else if let Err(error) = validate_group_name(&args.name, args.is_public, subtype.as_ref()) {
                return match error {
                    NameValidationError::TooShort(s) => NameTooShort(s),
                    NameValidationError::TooLong(l) => NameTooLong(l),
                    NameValidationError::Reserved => NameReserved,
                };
            }
        }

        if let Err(error) = validate_description(&args.description) {
            DescriptionTooLong(error)
        } else if let Err(error) = validate_rules(args.rules.enabled, &args.rules.text) {
            match error {
                RulesValidationError::TooShort(s) => RulesTooShort(s),
                RulesValidationError::TooLong(l) => RulesTooLong(l),
            }
        } else if let Err(error) = validate_avatar(args.avatar.as_ref()) {
            AvatarTooBig(error)
        } else if args.gate.as_ref().map(|g| !g.validate()).unwrap_or_default() {
            AccessGateInvalid
        } else if state.data.channels.is_name_taken(&args.name, None) {
            NameTaken
        } else {
            let now = state.env.now();
            let permissions = args.permissions_v2.unwrap_or_default();

            let chat = GroupChatCore::new(
                MultiUserChat::Channel(state.env.canister_id().into(), channel_id),
                member.user_id,
                args.is_public,
                args.name,
                args.description,
                args.rules,
                subtype,
                args.avatar,
                args.history_visible_to_new_joiners,
                messages_visible_to_non_members,
                permissions,
                args.gate.clone(),
                args.events_ttl,
                member.user_type,
                state.env.rng().gen(),
                args.external_url,
                now,
            );

            member.channels.insert(channel_id);

            let mut channel = Channel {
                id: channel_id,
                chat,
                date_imported: None,
            };

            if args.is_public {
                match args.gate {
                    Some(AccessGate::DiamondMember) => {
                        add_members_to_public_channel_unchecked(
                            &mut channel,
                            state
                                .data
                                .members
                                .iter_mut()
                                .filter(|m| diamond_membership_expiry_dates.get(&m.user_id).copied() > Some(now)),
                            now,
                        );
                    }
                    None => add_members_to_public_channel_unchecked(&mut channel, state.data.members.iter_mut(), now),
                    _ => {}
                }
            }

            state.data.channels.add(channel);

            handle_activity_notification(state);
            Success(SuccessResult { channel_id })
        }
    } else {
        NotAuthorized
    }
}

async fn get_diamond_membership_expiry_dates_if_needed(args: &Args) -> Result<HashMap<UserId, TimestampMillis>, Response> {
    if let Some(AccessGate::DiamondMember) = &args.gate {
        let (local_user_index_canister_id, user_ids) = read_state(|state| {
            (
                state.data.local_user_index_canister_id,
                state.data.members.iter().map(|u| u.user_id).collect(),
            )
        });

        match local_user_index_canister_c2c_client::c2c_diamond_membership_expiry_dates(
            local_user_index_canister_id,
            &local_user_index_canister::c2c_diamond_membership_expiry_dates::Args { user_ids },
        )
        .await
        {
            Ok(local_user_index_canister::c2c_diamond_membership_expiry_dates::Response::Success(expiry_dates)) => {
                Ok(expiry_dates)
            }
            Err(error) => Err(InternalError(format!("{error:?}"))),
        }
    } else {
        Ok(HashMap::new())
    }
}
