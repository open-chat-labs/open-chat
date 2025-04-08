use crate::jobs;
use crate::timer_job_types::JoinMembersToPublicChannelJob;
use crate::{activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::update_channel::{Response::*, *};
use oc_error_codes::OCErrorCode;
use types::{OCResult, OptionUpdate};
use url::Url;

#[update(msgpack = true)]
#[trace]
fn update_channel(args: Args) -> Response {
    run_regular_jobs();

    match mutate_state(|state| update_channel_impl(args, state)) {
        Ok(result) => SuccessV2(result),
        Err(error) => Error(error),
    }
}

fn update_channel_impl(mut args: Args, state: &mut RuntimeState) -> OCResult<SuccessResult> {
    clean_args(&mut args);

    if state.data.is_frozen() {
        return Err(OCErrorCode::CommunityFrozen.into());
    }

    if let OptionUpdate::SetToSome(external_url) = &args.external_url {
        if Url::parse(external_url).is_err() {
            return Err(OCErrorCode::InvalidExternalUrl.into());
        }
    }

    if let OptionUpdate::SetToSome(gate_config) = &args.gate_config {
        if !gate_config.validate(state.data.test_mode) {
            return Err(OCErrorCode::InvalidAccessGate.into());
        }
    }

    if let Some(name) = &args.name {
        if state.data.channels.is_name_taken(name, Some(args.channel_id)) {
            return Err(OCErrorCode::NameTaken.into());
        }
    }

    if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
        let caller = state.env.caller();

        if let Some(member) = state.data.members.get(caller) {
            let now = state.env.now();
            let has_gate_config_updates = args.gate_config.has_update();

            let prev_gate_config = channel.chat.gate_config.value.clone();

            let result = channel.chat.update(
                member.user_id,
                args.name,
                args.description,
                args.rules,
                args.avatar,
                args.permissions_v2,
                args.gate_config.map(|gc| gc.into()),
                args.public,
                args.messages_visible_to_non_members,
                args.events_ttl,
                args.external_url,
                now,
            )?;

            if channel.chat.is_public.value && channel.chat.gate_config.is_none() {
                // If the channel has just been made public or had its gate removed, add
                // all existing community members to the channel, except those who have
                // been in the channel before and then left
                if result.newly_public || matches!(result.gate_config_update, OptionUpdate::SetToNone) {
                    let channel_id = channel.id;
                    let mut user_ids = Vec::with_capacity(state.data.members.len());
                    user_ids.extend(
                        state
                            .data
                            .members
                            .iter_member_ids()
                            .filter(|user_id| !state.data.members.member_channel_links_removed_contains(*user_id, channel_id)),
                    );

                    JoinMembersToPublicChannelJob {
                        channel_id,
                        members: user_ids,
                    }
                    .execute_with_state(state);
                }
            }

            if has_gate_config_updates {
                state.data.update_member_expiry(Some(args.channel_id), &prev_gate_config, now);
                jobs::expire_members::restart_job(state);
            }

            handle_activity_notification(state);

            Ok(SuccessResult {
                rules_version: result.rules_version,
            })
        } else {
            Err(OCErrorCode::InitiatorNotInCommunity.into())
        }
    } else {
        Err(OCErrorCode::ChatNotFound.into())
    }
}

fn clean_args(args: &mut Args) {
    args.name = args.name.as_ref().map(|name| name.trim().to_string());
    args.description = args.description.as_ref().map(|desc| desc.trim().to_string());

    if let Some(rules) = &mut args.rules {
        rules.text = rules.text.trim().to_string();
    }
}
