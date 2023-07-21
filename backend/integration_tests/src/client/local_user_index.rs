use crate::generate_update_call;
use local_user_index_canister::*;

// Queries

// Updates
generate_update_call!(invite_users_to_channel);
generate_update_call!(invite_users_to_community);
generate_update_call!(invite_users_to_group);
generate_update_call!(join_channel);
generate_update_call!(join_community);
generate_update_call!(join_group);
generate_update_call!(register_user);
generate_update_call!(report_message);

pub mod happy_path {
    use crate::rng::random_user_principal;
    use crate::utils::principal_to_username;
    use crate::User;
    use candid::Principal;
    use ic_test_state_machine_client::StateMachine;
    use types::{CanisterId, ChannelId, ChatId, CommunityId, UserId};

    pub fn register_user(env: &mut StateMachine, canister_id: CanisterId) -> User {
        register_user_with_referrer(env, canister_id, None)
    }

    pub fn register_user_with_referrer(env: &mut StateMachine, canister_id: CanisterId, referral_code: Option<String>) -> User {
        let (principal, public_key) = random_user_principal();

        let response = super::register_user(
            env,
            principal,
            canister_id,
            &local_user_index_canister::register_user::Args {
                username: principal_to_username(principal),
                referral_code,
                public_key,
            },
        );

        env.tick();

        match response {
            local_user_index_canister::register_user::Response::Success(res) => User {
                principal,
                user_id: res.user_id,
            },
            response => panic!("'register_user' error: {response:?}"),
        }
    }

    pub fn invite_users_to_group(
        env: &mut StateMachine,
        sender: Principal,
        local_user_index_canister_id: CanisterId,
        group_id: ChatId,
        user_ids: Vec<UserId>,
    ) {
        let response = super::invite_users_to_group(
            env,
            sender,
            local_user_index_canister_id,
            &local_user_index_canister::invite_users_to_group::Args {
                group_id,
                user_ids,
                correlation_id: 0,
            },
        );

        match response {
            local_user_index_canister::invite_users_to_group::Response::Success => {}
            response => panic!("'invite_users_to_group' error: {response:?}"),
        }
    }

    pub fn join_group(env: &mut StateMachine, sender: Principal, local_user_index_canister_id: CanisterId, chat_id: ChatId) {
        let response = super::join_group(
            env,
            sender,
            local_user_index_canister_id,
            &local_user_index_canister::join_group::Args {
                chat_id,
                invite_code: None,
                correlation_id: 0,
            },
        );

        match response {
            local_user_index_canister::join_group::Response::Success(_) => {}
            response => panic!("'join_group' error: {response:?}"),
        }
    }

    pub fn add_users_to_group(
        env: &mut StateMachine,
        sender: Principal,
        local_user_index_canister_id: CanisterId,
        group_id: ChatId,
        users: Vec<(UserId, Principal)>,
    ) {
        invite_users_to_group(
            env,
            sender,
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
        env: &mut StateMachine,
        sender: Principal,
        local_user_index_canister_id: CanisterId,
        community_id: CommunityId,
        user_ids: Vec<UserId>,
    ) {
        let response = super::invite_users_to_community(
            env,
            sender,
            local_user_index_canister_id,
            &local_user_index_canister::invite_users_to_community::Args { community_id, user_ids },
        );

        match response {
            local_user_index_canister::invite_users_to_community::Response::Success => {}
            response => panic!("'invite_users_to_community' error: {response:?}"),
        }
    }

    pub fn invite_users_to_channel(
        env: &mut StateMachine,
        sender: Principal,
        local_user_index_canister_id: CanisterId,
        community_id: CommunityId,
        channel_id: ChannelId,
        user_ids: Vec<UserId>,
    ) {
        let response = super::invite_users_to_channel(
            env,
            sender,
            local_user_index_canister_id,
            &local_user_index_canister::invite_users_to_channel::Args {
                community_id,
                channel_id,
                user_ids,
            },
        );

        match response {
            local_user_index_canister::invite_users_to_channel::Response::Success => {}
            response => panic!("'invite_users_to_channel' error: {response:?}"),
        }
    }

    pub fn join_community(
        env: &mut StateMachine,
        sender: Principal,
        local_user_index_canister_id: CanisterId,
        community_id: CommunityId,
    ) {
        let response = super::join_community(
            env,
            sender,
            local_user_index_canister_id,
            &local_user_index_canister::join_community::Args {
                community_id,
                invite_code: None,
            },
        );

        match response {
            local_user_index_canister::join_community::Response::Success(_) => {}
            response => panic!("'join_community' error: {response:?}"),
        }
    }

    pub fn join_channel(
        env: &mut StateMachine,
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
            },
        );

        match response {
            local_user_index_canister::join_channel::Response::Success(_)
            | local_user_index_canister::join_channel::Response::SuccessJoinedCommunity(_) => {}
            response => panic!("'join_channel' error: {response:?}"),
        }
    }

    pub fn add_users_to_community(
        env: &mut StateMachine,
        sender: Principal,
        local_user_index_canister_id: CanisterId,
        community_id: CommunityId,
        users: Vec<(UserId, Principal)>,
    ) {
        invite_users_to_community(
            env,
            sender,
            local_user_index_canister_id,
            community_id,
            users.iter().map(|(user_id, _)| *user_id).collect(),
        );

        for (_, principal) in users {
            join_community(env, principal, local_user_index_canister_id, community_id);
        }

        env.tick();
    }
}
