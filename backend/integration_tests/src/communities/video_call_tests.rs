use crate::client::{local_user_index, user_index};
use crate::env::ENV;
use crate::rng::random_string;
use crate::utils::{generate_seed, tick_many};
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use jwt_simple::algorithms::{ECDSAP256PublicKeyLike, ES256PublicKey};
use pocket_ic::PocketIc;
use std::error::Error;
use std::ops::Deref;
use std::time::SystemTime;
use types::{AccessTokenType, ChannelId, CommunityId, VideoCallClaims};

#[test]
fn access_token_valid() {
    let seed = generate_seed();
    let mut wrapper = ENV.deref().get_with_seed(seed);

    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    env.set_time(SystemTime::now());

    let TestData {
        user1,
        community_id,
        channel_id,
    } = init_test_data(env, canister_ids, *controller);

    tick_many(env, 10);

    let public_key = user_index::happy_path::public_key(env, user1.principal, canister_ids.user_index);

    println!("{public_key}");

    let token = local_user_index::happy_path::access_token(
        env,
        &user1,
        canister_ids.local_user_index,
        community_id,
        channel_id,
        AccessTokenType::StartVideoCall,
    );

    println!("{token}");

    let claims = decode_and_verify_token(token, public_key).expect("Expected to decode the token");

    assert_eq!(user1.user_id, claims.user_id);
}

fn init_test_data(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);

    let community_id =
        client::user::happy_path::create_community(env, &user1, &random_string(), true, vec!["general".to_string()]);

    let summary = client::community::happy_path::summary(env, &user1, community_id);

    TestData {
        user1,
        community_id,
        channel_id: summary.channels.first().unwrap().channel_id,
    }
}

fn decode_and_verify_token(token: String, public_key_pem: String) -> Result<VideoCallClaims, Box<dyn Error>> {
    let public_key = ES256PublicKey::from_pem(&public_key_pem)?;

    let claims = public_key.verify_token(&token, None)?;

    Ok(claims.custom)
}

struct TestData {
    user1: User,
    community_id: CommunityId,
    channel_id: ChannelId,
}
