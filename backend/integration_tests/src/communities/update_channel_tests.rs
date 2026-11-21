use crate::env::ENV;
use crate::{TestEnv, client};
use oc_error_codes::OCErrorCode;
use std::ops::Deref;
use test_case::test_case;
use testing::rng::random_string;
use types::{
    AccessGate, CustomPermission, GroupPermissionRole, OptionUpdate, OptionalGroupPermissions, OptionalMessagePermissions,
};

#[test_case(true)]
#[test_case(false)]
fn members_added_if_channel_made_public_or_gate_removed(make_public: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user1 = client::register_diamond_user(env, canister_ids, *controller);
    let user2 = client::register_diamond_user(env, canister_ids, *controller);
    let user3 = client::register_user(env, canister_ids);

    let community_id = client::user::happy_path::create_community(env, &user1, &random_string(), true, vec![random_string()]);

    let channel_id = if make_public {
        client::community::happy_path::create_channel(env, user1.principal, community_id, false, random_string())
    } else {
        client::community::happy_path::create_gated_channel(
            env,
            user1.principal,
            community_id,
            true,
            random_string(),
            AccessGate::DiamondMember,
        )
    };

    client::local_user_index::happy_path::invite_users_to_channel(
        env,
        &user1,
        canister_ids.local_user_index(env, community_id),
        community_id,
        channel_id,
        vec![user2.user_id],
    );
    client::community::happy_path::join_channel(env, user2.principal, community_id, channel_id);

    for i in 0..5 {
        client::community::happy_path::send_text_message(env, &user1, community_id, channel_id, None, i.to_string(), None);
    }

    client::community::happy_path::leave_channel(env, user2.principal, community_id, channel_id);
    client::community::happy_path::join_community(env, user3.principal, community_id);
    client::community::happy_path::update_channel(
        env,
        user1.principal,
        community_id,
        &community_canister::update_channel::Args {
            channel_id,
            name: None,
            description: None,
            rules: None,
            avatar: OptionUpdate::NoChange,
            permissions_v2: None,
            events_ttl: OptionUpdate::NoChange,
            gate_config: if !make_public { OptionUpdate::SetToNone } else { OptionUpdate::NoChange },
            public: make_public.then_some(true),
            messages_visible_to_non_members: None,
            external_url: OptionUpdate::NoChange,
        },
    );

    // Check that user2 has not been re-added to the channel
    let user2_channel_summary = client::community::happy_path::summary(env, user2.principal, community_id);

    assert!(!user2_channel_summary.channels.iter().any(|c| c.channel_id == channel_id));

    // Check that user3 has been added to the channel
    let user3_channel_summary = client::community::happy_path::channel_summary(env, &user3, community_id, channel_id);

    if make_public {
        assert!(user3_channel_summary.is_public);
        assert_eq!(user3_channel_summary.min_visible_event_index, 10.into());
        assert_eq!(user3_channel_summary.min_visible_message_index, 5.into());
    } else {
        assert!(user3_channel_summary.gate_config.is_none());
        assert_eq!(user3_channel_summary.min_visible_event_index, 0.into());
        assert_eq!(user3_channel_summary.min_visible_message_index, 0.into());
    }
}

// Invariant: update_channel returns InvalidExternalUrl for a non-https external_url.
#[test_case("javascript:alert(1)")]
fn update_channel_rejects_non_https_external_url(external_url: &str) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user = client::register_diamond_user(env, canister_ids, *controller);
    let community_id = client::user::happy_path::create_community(env, &user, &random_string(), true, vec![random_string()]);
    let channel_id = client::community::happy_path::create_channel(env, user.principal, community_id, true, random_string());

    let response = client::community::update_channel(
        env,
        user.principal,
        community_id.into(),
        &community_canister::update_channel::Args {
            channel_id,
            name: None,
            description: None,
            rules: None,
            avatar: OptionUpdate::NoChange,
            permissions_v2: None,
            events_ttl: OptionUpdate::NoChange,
            gate_config: OptionUpdate::NoChange,
            public: None,
            messages_visible_to_non_members: None,
            external_url: OptionUpdate::SetToSome(external_url.to_string()),
        },
    );

    assert!(
        matches!(&response, community_canister::update_channel::Response::Error(e) if e.matches_code(OCErrorCode::InvalidExternalUrl)),
        "{response:?}"
    );
}

#[test]
fn meme_fighter_permission_set_for_the_first_time_is_saved_and_can_be_removed() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user1 = client::register_diamond_user(env, canister_ids, *controller);
    let user2 = client::register_user(env, canister_ids);
    let community_id = client::user::happy_path::create_community(env, &user1, &random_string(), true, vec![random_string()]);
    let channel_id = client::community::happy_path::create_channel(env, user1.principal, community_id, true, random_string());
    client::community::happy_path::join_community(env, user2.principal, community_id);
    client::community::happy_path::join_channel(env, user2.principal, community_id, channel_id);

    let update = |env: &mut pocket_ic::PocketIc, custom_updated: Vec<CustomPermission>, custom_deleted: Vec<String>| {
        client::community::happy_path::update_channel(
            env,
            user1.principal,
            community_id,
            &community_canister::update_channel::Args {
                channel_id,
                name: None,
                description: None,
                rules: None,
                avatar: OptionUpdate::NoChange,
                permissions_v2: Some(OptionalGroupPermissions {
                    message_permissions: Some(OptionalMessagePermissions {
                        custom_updated,
                        custom_deleted,
                        ..Default::default()
                    }),
                    ..Default::default()
                }),
                events_ttl: OptionUpdate::NoChange,
                gate_config: OptionUpdate::NoChange,
                public: None,
                messages_visible_to_non_members: None,
                external_url: OptionUpdate::NoChange,
            },
        );
    };

    // Set for the first time
    update(
        env,
        vec![CustomPermission {
            subtype: "meme_fighter".to_string(),
            role: GroupPermissionRole::Admins,
        }],
        Vec::new(),
    );

    // A member reads it back: the channel kept it
    let summary = client::community::happy_path::channel_summary(env, &user2, community_id, channel_id);
    let custom = summary.permissions_v2.message_permissions.custom;
    assert_eq!(custom.len(), 1, "{custom:?}");
    assert_eq!(custom[0].subtype, "meme_fighter");
    assert_eq!(custom[0].role, GroupPermissionRole::Admins);

    // Back to "Same as default"
    update(env, Vec::new(), vec!["meme_fighter".to_string()]);

    let summary = client::community::happy_path::channel_summary(env, &user2, community_id, channel_id);
    assert!(
        summary.permissions_v2.message_permissions.custom.is_empty(),
        "{:?}",
        summary.permissions_v2.message_permissions.custom
    );
}
