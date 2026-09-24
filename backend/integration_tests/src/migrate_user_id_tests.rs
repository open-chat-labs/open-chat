use crate::client;
use crate::env::ENV;
use crate::utils::tick_many;
use crate::{TestEnv, User};
use std::ops::Deref;
use testing::rng::random_string;
use types::{ChatEvent, GroupRole, UnitResult, UserId};

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
            groups: vec![group_id],
        },
    );
    assert!(matches!(response, UnitResult::Success), "{response:?}");
    tick_many(env, 5);

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
}
