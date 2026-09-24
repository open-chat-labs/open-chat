use crate::client;
use crate::env::ENV;
use crate::utils::tick_many;
use crate::{TestEnv, User};
use oc_error_codes::OCErrorCode;
use pocket_ic::PocketIc;
use std::ops::Deref;
use testing::rng::{random_from_u128, random_string};
use types::{
    ChatEvent, ChatId, GroupRole, MessageContent, MessageContentInitial, MessageId, Reaction, TextContent, UnitResult, UserId,
};

#[test]
fn group_member_moved_to_new_user_id() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let user = client::register_user(env, canister_ids);
    let group_id = client::user::happy_path::create_group(env, &owner, &random_string(), true, true);
    client::group::happy_path::join_group(env, user.principal, group_id);
    client::group::happy_path::change_role(env, owner.principal, group_id, user.user_id, GroupRole::Admin);
    let old_message_id = random_from_u128();
    let old_message =
        client::group::happy_path::send_text_message(env, &user, group_id, None, random_string(), Some(old_message_id));
    add_reaction(env, &user, group_id, old_message_id);
    tick_many(env, 3);

    // The id the user is given in the MultiUser canister they are migrated to
    let new_user_id = UserId::new_indexed(user.local_user_index, 1);

    let response = client::user_index::record_user_id_migrated(
        env,
        *controller,
        canister_ids.user_index,
        &user_index_canister::record_user_id_migrated::Args {
            old_user_id: user.user_id,
            new_user_id,
            canisters_to_notify: vec![group_id.into()],
        },
    );
    assert!(matches!(response, UnitResult::Success), "{response:?}");
    tick_many(env, 5);

    // Recording the same migration again does nothing
    let response = client::user_index::record_user_id_migrated(
        env,
        *controller,
        canister_ids.user_index,
        &user_index_canister::record_user_id_migrated::Args {
            old_user_id: user.user_id,
            new_user_id,
            canisters_to_notify: vec![group_id.into()],
        },
    );
    assert!(matches!(response, UnitResult::Error(e) if e.matches_code(OCErrorCode::NoChange)));

    let group = client::group::happy_path::selected_initial(env, owner.principal, group_id);
    assert!(!group.participants.iter().any(|m| m.user_id == user.user_id));
    let member = group.participants.iter().find(|m| m.user_id == new_user_id).unwrap();
    assert_eq!(member.role, GroupRole::Admin);

    // The user still signs in with the same principal, which the group now maps to their new id
    let migrated_user = User {
        user_id: new_user_id,
        ..user
    };
    let message = client::group::happy_path::send_text_message(env, &migrated_user, group_id, None, random_string(), None);

    let events = client::group::happy_path::events_by_index(env, &owner, group_id, vec![message.event_index]);
    let Some(ChatEvent::Message(m)) = events.events.first().map(|e| &e.event) else {
        panic!("{events:?}");
    };
    assert_eq!(m.sender, new_user_id);

    // The message the user sent, and the reaction they left, before being migrated are still theirs
    let response = add_reaction(env, &migrated_user, group_id, old_message_id);
    assert!(
        matches!(response, UnitResult::Error(ref e) if e.matches_code(OCErrorCode::NoChange)),
        "{response:?}"
    );

    let response = client::group::edit_message_v2(
        env,
        migrated_user.principal,
        group_id.into(),
        &group_canister::edit_message_v2::Args {
            thread_root_message_index: None,
            message_id: old_message_id,
            content: MessageContentInitial::Text(TextContent {
                text: "edited".to_string(),
            }),
            block_level_markdown: None,
            new_achievement: false,
            og_previews: Vec::new(),
        },
    );
    assert!(matches!(response, UnitResult::Success), "{response:?}");

    let response = client::group::remove_reaction(
        env,
        migrated_user.principal,
        group_id.into(),
        &group_canister::remove_reaction::Args {
            thread_root_message_index: None,
            message_id: old_message_id,
            reaction: Reaction::new("👍".to_string()),
        },
    );
    assert!(matches!(response, UnitResult::Success), "{response:?}");

    let response = client::group::delete_messages(
        env,
        migrated_user.principal,
        group_id.into(),
        &group_canister::delete_messages::Args {
            thread_root_message_index: None,
            message_ids: vec![old_message_id],
            as_platform_moderator: None,
            new_achievement: false,
        },
    );
    assert!(matches!(response, UnitResult::Success), "{response:?}");

    let events = client::group::happy_path::events_by_index(env, &owner, group_id, vec![old_message.event_index]);
    let Some(ChatEvent::Message(m)) = events.events.first().map(|e| &e.event) else {
        panic!("{events:?}");
    };
    // Deleted by its sender, as recorded under the id they sent it with
    assert_eq!(m.sender, user.user_id);
    assert!(
        matches!(m.content, MessageContent::Deleted(ref d) if d.deleted_by == user.user_id),
        "{m:?}"
    );
    assert!(m.reactions.is_empty());
}

fn add_reaction(env: &mut PocketIc, user: &User, group_id: ChatId, message_id: MessageId) -> UnitResult {
    client::group::add_reaction(
        env,
        user.principal,
        group_id.into(),
        &group_canister::add_reaction::Args {
            thread_root_message_index: None,
            message_id,
            reaction: Reaction::new("👍".to_string()),
            username: user.username(),
            display_name: None,
            new_achievement: false,
        },
    )
}

#[test]
fn invited_user_moved_to_new_user_id() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let user = client::register_user(env, canister_ids);
    let group_id = client::user::happy_path::create_group(env, &owner, &random_string(), false, true);
    client::local_user_index::happy_path::invite_users_to_group(
        env,
        &owner,
        canister_ids.local_user_index(env, group_id),
        group_id,
        vec![user.user_id],
    );
    tick_many(env, 3);

    let new_user_id = UserId::new_indexed(user.local_user_index, 1);
    let response = client::user_index::record_user_id_migrated(
        env,
        *controller,
        canister_ids.user_index,
        &user_index_canister::record_user_id_migrated::Args {
            old_user_id: user.user_id,
            new_user_id,
            canisters_to_notify: vec![group_id.into()],
        },
    );
    assert!(matches!(response, UnitResult::Success), "{response:?}");
    tick_many(env, 5);

    let group = client::group::happy_path::selected_initial(env, owner.principal, group_id);
    assert!(group.invited_users.contains(&new_user_id));
    assert!(!group.invited_users.contains(&user.user_id));

    // The user's principal, which is unchanged, finds their invitation under their new id
    let response = client::group::public_summary(
        env,
        user.principal,
        group_id.into(),
        &group_canister::public_summary::Args { invite_code: None },
    );
    assert!(
        matches!(response, group_canister::public_summary::Response::Success(ref r) if r.is_invited),
        "{response:?}"
    );
}
