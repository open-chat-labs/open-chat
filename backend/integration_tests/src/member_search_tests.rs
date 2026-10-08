use crate::env::ENV;
use crate::{TestEnv, client};
use std::ops::Deref;
use testing::rng::random_string;
use types::UserId;

// A client which holds only some of a chat's or community's members finds those it doesn't hold by
// searching for users by name, then looking up which of them are members

#[test]
fn community_members_are_found_by_their_display_names() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let community_id = client::user::happy_path::create_community(env, &owner, &random_string(), true, vec![random_string()]);
    let mut members = Vec::new();
    for display_name in ["Bobby", "Jimbob", "Alice", "bob"] {
        let user = client::register_user(env, canister_ids);
        client::community::happy_path::join_community(env, user.principal, community_id);
        let response = client::community::set_member_display_name(
            env,
            user.principal,
            community_id.into(),
            &community_canister::set_member_display_name::Args {
                display_name: Some(display_name.to_string()),
                new_achievement: false,
            },
        );
        assert!(matches!(response, types::UnitResult::Success), "{response:?}");
        members.push(user);
    }

    let search = |env: &mut _, search_term: &str, max_results: u8| {
        let community_canister::search_members::Response::Success(result) = client::community::search_members(
            env,
            owner.principal,
            community_id.into(),
            &community_canister::search_members::Args {
                invite_code: None,
                search_term: search_term.to_string(),
                max_results,
                latest_known_update: None,
            },
        ) else {
            panic!("'search_members' failed");
        };
        result.members.iter().map(|m| m.user_id).collect::<Vec<UserId>>()
    };

    // Those whose display names start with the term (ignoring case) come first, shortest first,
    // then those whose display names contain it
    assert_eq!(
        search(env, "BOB", 10),
        vec![members[3].user_id, members[0].user_id, members[1].user_id]
    );
    assert_eq!(search(env, "bob", 1), vec![members[3].user_id]);
    assert!(search(env, "carol", 10).is_empty());
}
