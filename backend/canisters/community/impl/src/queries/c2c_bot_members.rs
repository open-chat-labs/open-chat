use crate::Data;
use crate::RuntimeState;
use crate::guards::caller_is_local_user_index;
use crate::read_state;
use canister_api_macros::query;
use community_canister::c2c_bot_members::*;
use group_chat_core::GroupChatCore;
use oc_error_codes::OCErrorCode;
use std::collections::HashMap;
use types::ChatPermission;
use types::CommunityPermission;
use types::CommunityRole;
use types::GroupRole;
use types::MemberType;
use types::MembersResponse;
use types::MembersResult;
use types::UserId;
use types::{BotPermissions, OCResult};

#[query(guard = "caller_is_local_user_index", msgpack = true)]
fn c2c_bot_members(args: Args) -> MembersResponse {
    read_state(|state| match c2c_bot_members_impl(args, state) {
        Ok(members) => MembersResponse::Success(members),
        Err(error) => MembersResponse::Error(error),
    })
}

fn c2c_bot_members_impl(args: Args, state: &RuntimeState) -> OCResult<MembersResult> {
    let required_permissions = if args.channel_id.is_some() {
        BotPermissions::from_chat_permission(ChatPermission::ReadMembership)
    } else {
        BotPermissions::from_community_permission(CommunityPermission::ReadMembership)
    };

    if !state
        .data
        .is_bot_permitted(&args.bot_id, args.channel_id, &args.initiator, &required_permissions)
    {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    let mut members_map = HashMap::new();

    for member_type in args.member_types {
        let user_ids = if let Some(channel_id) = args.channel_id {
            let Some(channel) = state.data.channels.get(&channel_id) else {
                return Err(OCErrorCode::ChatNotFound.into());
            };
            channel_users_by_type(&channel.chat, member_type)
        } else {
            community_users_by_type(&state.data, member_type)
        };

        if !user_ids.is_empty() {
            members_map.insert(member_type, user_ids);
        }
    }

    Ok(MembersResult {
        members_map,
        timestamp: state.env.now(),
    })
}

fn community_users_by_type(data: &Data, member_type: MemberType) -> Vec<UserId> {
    match member_type {
        MemberType::Owner => data.members.owners().iter().copied().collect(),
        MemberType::Admin => data.members.admins().iter().copied().collect(),
        MemberType::Member => data
            .members
            .member_ids()
            .filter(|user_id| matches!(data.members.role(user_id), Some(CommunityRole::Member)))
            .copied()
            .collect(),
        MemberType::Lapsed => data.members.lapsed().iter().copied().collect(),
        MemberType::Blocked => data.members.blocked(),
        MemberType::Invited => data.invited_users.user_ids().copied().collect(),
        MemberType::Bot => data.bots.user_ids().copied().collect(),
        MemberType::Webhook | MemberType::Moderator => vec![],
    }
}

fn channel_users_by_type(chat: &GroupChatCore, member_type: MemberType) -> Vec<UserId> {
    match member_type {
        MemberType::Owner => chat.members.owners().iter().copied().collect(),
        MemberType::Admin => chat.members.admins().iter().copied().collect(),
        MemberType::Moderator => chat.members.moderators().iter().copied().collect(),
        MemberType::Member => chat
            .members
            .member_ids()
            .iter()
            .filter(|user_id| matches!(chat.members.role(user_id), Some(GroupRole::Participant)))
            .copied()
            .collect(),
        MemberType::Lapsed => chat.members.lapsed().iter().copied().collect(),
        MemberType::Invited => chat.invited_users.user_ids().copied().collect(),
        MemberType::Webhook => chat.webhooks.user_ids().copied().collect(),
        MemberType::Blocked | MemberType::Bot => vec![],
    }
}
