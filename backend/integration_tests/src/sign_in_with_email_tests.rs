use crate::env::ENV;
use crate::{TestEnv, client};
use sign_in_with_email_test_utils::generate_magic_link;
use std::ops::Deref;
use testing::rng::random_internet_identity_principal;
use types::HttpRequest;

#[test]
fn end_to_end() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let (principal, public_key) = random_internet_identity_principal();
    let email = "blah@blah.com";

    let generate_magic_link_response = client::sign_in_with_email::generate_magic_link(
        env,
        principal,
        canister_ids.sign_in_with_email,
        &sign_in_with_email_canister::generate_magic_link::Args {
            email: email.to_string(),
            session_key: public_key.clone(),
            max_time_to_live: None,
        },
    );

    let sign_in_with_email_canister::generate_magic_link::Response::Success(generate_magic_link_success) =
        generate_magic_link_response
    else {
        panic!();
    };

    let signed = generate_magic_link(
        email,
        public_key.clone(),
        generate_magic_link_success.created,
        generate_magic_link_success.expiration,
        generate_magic_link_success.code.clone(),
    );

    let http_request = HttpRequest {
        method: "GET".to_string(),
        url: format!(
            "https://canister_id.icp0.io/auth{}&c={}",
            signed.build_querystring(),
            generate_magic_link_success.code
        ),
        headers: Vec::new(),
        body: Vec::new(),
    };

    let http_response = client::http_request(env, principal, canister_ids.sign_in_with_email, &http_request);

    assert_eq!(http_response.status_code, 200);
    assert!(http_response.upgrade.unwrap());

    let http_response = client::http_request_update(env, principal, canister_ids.sign_in_with_email, &http_request);

    assert_eq!(http_response.status_code, 200);

    let get_delegation_response = client::sign_in_with_email::get_delegation(
        env,
        principal,
        canister_ids.sign_in_with_email,
        &sign_in_with_email_canister::get_delegation::Args {
            email: email.to_string(),
            session_key: public_key,
            expiration: generate_magic_link_success.expiration,
        },
    );

    assert!(matches!(
        get_delegation_response,
        sign_in_with_email_canister::get_delegation::Response::Success(_)
    ));
}
