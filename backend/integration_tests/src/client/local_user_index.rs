use crate::{generate_msgpack_query_call, generate_msgpack_update_call};
use local_user_index_canister::*;

// Queries
generate_msgpack_query_call!(access_token);
generate_msgpack_query_call!(chat_events);
generate_msgpack_query_call!(group_and_community_summary_updates);

// Updates
generate_msgpack_update_call!(execute_bot_command);
generate_msgpack_update_call!(invite_users_to_channel);
generate_msgpack_update_call!(invite_users_to_community);
generate_msgpack_update_call!(invite_users_to_group);
generate_msgpack_update_call!(join_channel);
generate_msgpack_update_call!(join_community);
generate_msgpack_update_call!(join_group);
generate_msgpack_update_call!(register_user);
generate_msgpack_update_call!(report_message_v2);

pub mod happy_path {
    use crate::utils::{principal_to_username, tick_many};
    use crate::User;
    use candid::Principal;
    use pocket_ic::PocketIc;
    use types::{AccessTokenType, CanisterId, ChannelId, Chat, ChatId, CommunityCanisterCommunitySummary, CommunityId, UserId};

    pub fn register_user(env: &mut PocketIc, principal: Principal, canister_id: CanisterId, public_key: Vec<u8>) -> User {
        register_user_with_referrer(env, principal, canister_id, public_key, None)
    }

    pub fn register_user_with_referrer(
        env: &mut PocketIc,
        principal: Principal,
        canister_id: CanisterId,
        public_key: Vec<u8>,
        referral_code: Option<String>,
    ) -> User {
        let response = super::register_user(
            env,
            principal,
            canister_id,
            &local_user_index_canister::register_user::Args {
                username: principal_to_username(principal),
                referral_code,
                public_key: public_key.clone(),
            },
        );

        tick_many(env, 3);

        match response {
            local_user_index_canister::register_user::Response::Success(res) => User {
                principal,
                user_id: res.user_id,
                public_key,
            },
            response => panic!("'register_user' error: {response:?}"),
        }
    }

    pub fn invite_users_to_group(
        env: &mut PocketIc,
        user: &User,
        local_user_index_canister_id: CanisterId,
        group_id: ChatId,
        user_ids: Vec<UserId>,
    ) {
        let response = super::invite_users_to_group(
            env,
            user.principal,
            local_user_index_canister_id,
            &local_user_index_canister::invite_users_to_group::Args {
                group_id,
                user_ids,
                caller_username: user.username(),
                correlation_id: 0,
            },
        );

        match response {
            local_user_index_canister::invite_users_to_group::Response::Success => {}
            response => panic!("'invite_users_to_group' error: {response:?}"),
        }
    }

    pub fn join_group(env: &mut PocketIc, sender: Principal, local_user_index_canister_id: CanisterId, chat_id: ChatId) {
        let response = super::join_group(
            env,
            sender,
            local_user_index_canister_id,
            &local_user_index_canister::join_group::Args {
                chat_id,
                invite_code: None,
                verified_credential_args: None,
                correlation_id: 0,
            },
        );

        match response {
            local_user_index_canister::join_group::Response::Success(_) => {}
            response => panic!("'join_group' error: {response:?}"),
        }
    }

    pub fn add_users_to_group(
        env: &mut PocketIc,
        user: &User,
        local_user_index_canister_id: CanisterId,
        group_id: ChatId,
        users: Vec<(UserId, Principal)>,
    ) {
        invite_users_to_group(
            env,
            user,
            local_user_index_canister_id,
            group_id,
            users.iter().map(|(user_id, _)| *user_id).collect(),
        );

        for (_, principal) in users {
            join_group(env, principal, local_user_index_canister_id, group_id);
        }

        env.tick();
    }

    pub fn invite_users_to_community(
        env: &mut PocketIc,
        user: &User,
        local_user_index_canister_id: CanisterId,
        community_id: CommunityId,
        user_ids: Vec<UserId>,
    ) {
        let response = super::invite_users_to_community(
            env,
            user.principal,
            local_user_index_canister_id,
            &local_user_index_canister::invite_users_to_community::Args {
                community_id,
                user_ids,
                caller_username: user.username(),
            },
        );

        match response {
            local_user_index_canister::invite_users_to_community::Response::Success => {}
            response => panic!("'invite_users_to_community' error: {response:?}"),
        }
    }

    pub fn invite_users_to_channel(
        env: &mut PocketIc,
        user: &User,
        local_user_index_canister_id: CanisterId,
        community_id: CommunityId,
        channel_id: ChannelId,
        user_ids: Vec<UserId>,
    ) {
        let response = super::invite_users_to_channel(
            env,
            user.principal,
            local_user_index_canister_id,
            &local_user_index_canister::invite_users_to_channel::Args {
                community_id,
                channel_id,
                user_ids,
                caller_username: user.username(),
            },
        );

        match response {
            local_user_index_canister::invite_users_to_channel::Response::Success => {}
            response => panic!("'invite_users_to_channel' error: {response:?}"),
        }
    }

    pub fn join_community(
        env: &mut PocketIc,
        sender: Principal,
        local_user_index_canister_id: CanisterId,
        community_id: CommunityId,
        referred_by: Option<UserId>,
    ) -> CommunityCanisterCommunitySummary {
        let response = super::join_community(
            env,
            sender,
            local_user_index_canister_id,
            &local_user_index_canister::join_community::Args {
                community_id,
                invite_code: None,
                referred_by,
                verified_credential_args: None,
            },
        );

        match response {
            local_user_index_canister::join_community::Response::Success(result) => *result,
            response => panic!("'join_community' error: {response:?}"),
        }
    }

    pub fn join_channel(
        env: &mut PocketIc,
        sender: Principal,
        local_user_index_canister_id: CanisterId,
        community_id: CommunityId,
        channel_id: ChannelId,
    ) {
        let response = super::join_channel(
            env,
            sender,
            local_user_index_canister_id,
            &local_user_index_canister::join_channel::Args {
                community_id,
                channel_id,
                invite_code: None,
                referred_by: None,
                verified_credential_args: None,
            },
        );

        match response {
            local_user_index_canister::join_channel::Response::Success(_)
            | local_user_index_canister::join_channel::Response::SuccessJoinedCommunity(_)
            | local_user_index_canister::join_channel::Response::AlreadyInChannel(_) => {}
            response => panic!("'join_channel' error: {response:?}"),
        }
    }

    pub fn add_users_to_community(
        env: &mut PocketIc,
        user: &User,
        local_user_index_canister_id: CanisterId,
        community_id: CommunityId,
        users: Vec<(UserId, Principal)>,
    ) {
        invite_users_to_community(
            env,
            user,
            local_user_index_canister_id,
            community_id,
            users.iter().map(|(user_id, _)| *user_id).collect(),
        );

        for (_, principal) in users {
            join_community(env, principal, local_user_index_canister_id, community_id, None);
        }

        env.tick();
    }

    pub fn access_token(
        env: &PocketIc,
        sender: &User,
        local_user_index_canister_id: CanisterId,
        community_id: CommunityId,
        channel_id: ChannelId,
        token_type: AccessTokenType,
    ) -> String {
        let response = super::access_token(
            env,
            sender.principal,
            local_user_index_canister_id,
            &local_user_index_canister::access_token::Args {
                token_type,
                chat: Chat::Channel(community_id, channel_id),
            },
        );

        match response {
            local_user_index_canister::access_token::Response::Success(token) => token,
            response => panic!("'access_token' error: {response:?}"),
        }
    }
}
