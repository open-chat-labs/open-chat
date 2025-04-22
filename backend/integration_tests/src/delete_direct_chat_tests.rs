use crate::env::ENV;
use crate::utils::{now_millis, tick_many};
use crate::{TestEnv, client};
use std::ops::Deref;
use std::time::Duration;
use testing::rng::random_string;
use types::ChatId;

#[test]
fn delete_direct_chat_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let start = now_millis(env);
    let user1 = client::register_user(env, canister_ids);
    let user2 = client::register_user(env, canister_ids);

    client::user::happy_path::send_text_message(env, &user1, user2.user_id, random_string(), None);

    env.advance_time(Duration::from_secs(1));

    let delete_direct_chat_response = client::user::delete_direct_chat(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::delete_direct_chat::Args {
            user_id: user2.user_id,
            block_user: false,
        },
    );

    assert!(
        matches!(
            delete_direct_chat_response,
            user_canister::delete_direct_chat::Response::Success
        ),
        "{delete_direct_chat_response:?}",
    );

    tick_many(env, 3);

    let user1_updates = client::user::happy_path::updates(env, &user1, start);
    assert_eq!(user1_updates.unwrap().direct_chats.removed, vec![ChatId::from(user2.user_id)]);

    let user1_initial_state = client::user::happy_path::initial_state(env, &user1);
    assert!(
        !user1_initial_state
            .direct_chats
            .summaries
            .iter()
            .any(|c| c.them == user2.user_id)
    );

    let user2_initial_state = client::user::happy_path::initial_state(env, &user2);
    assert!(
        !user2_initial_state
            .direct_chats
            .summaries
            .iter()
            .any(|c| c.them == user2.user_id)
    );
}
