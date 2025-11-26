use crate::client::register_user_and_include_auth;
use crate::env::ENV;
use crate::{CanisterIds, TestEnv, client};
use candid::Principal;
use constants::NANOS_PER_MILLISECOND;
use oc_error_codes::OCErrorCode;
use pocket_ic::PocketIc;
use rand::random;
use std::ops::Deref;
use std::time::Duration;
use test_case::test_case;
use testing::rng::{random_internet_identity_principal, random_string};
use types::{Delegation, Empty, SignedDelegation};

#[test_case(false)]
#[test_case(true)]
fn link_and_unlink_auth_identities(delay: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let (user1, user1_auth) = register_user_and_include_auth(env, canister_ids);
    let (user2_auth_principal, user2_public_key) = random_internet_identity_principal();

    let session_key2 = random::<[u8; 32]>().to_vec();

    client::identity::happy_path::initiate_identity_link(
        env,
        user2_auth_principal,
        canister_ids.identity,
        user2_public_key,
        true,
        user1_auth.auth_principal(),
    );

    if delay {
        env.advance_time(Duration::from_secs(301));
    }

    let approve_identity_link_response = client::identity::approve_identity_link(
        env,
        user1_auth.auth_principal(),
        canister_ids.identity,
        &identity_canister::approve_identity_link::Args {
            delegation: user1_auth.auth_delegation.clone(),
            public_key: user1_auth.auth_delegation.delegation.pubkey.clone(),
            link_initiated_by: user2_auth_principal,
        },
    );

    match approve_identity_link_response {
        identity_canister::approve_identity_link::Response::Success if !delay => {
            let prepare_delegation_response = client::identity::happy_path::prepare_delegation(
                env,
                user2_auth_principal,
                canister_ids.identity,
                session_key2,
            );

            let oc_principal2 = Principal::self_authenticating(prepare_delegation_response.user_key);

            assert_eq!(user1.principal, oc_principal2);
        }
        identity_canister::approve_identity_link::Response::Error(e)
            if delay && e.matches_code(OCErrorCode::DelegationTooOld) => {}
        response => panic!("{response:?}"),
    };

    if delay {
        return;
    }

    let remove_identity_link_response = client::identity::remove_identity_link(
        env,
        user1_auth.auth_principal(),
        canister_ids.identity,
        &identity_canister::remove_identity_link::Args {
            linked_principal: user2_auth_principal,
        },
    );

    match remove_identity_link_response {
        identity_canister::remove_identity_link::Response::Success => {
            let response =
                client::identity::check_auth_principal_v2(env, user2_auth_principal, canister_ids.identity, &Empty {});

            assert!(matches!(
                response,
                identity_canister::check_auth_principal_v2::Response::NotFound
            ));
        }
        response => panic!("{response:?}"),
    }
}

#[test]
fn link_identities_via_qr_code() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let (_, user1_auth) = register_user_and_include_auth(env, canister_ids);
    let (user2_auth_principal, user2_public_key) = random_internet_identity_principal();
    let link_code = random();

    client::identity::happy_path::initiate_identity_link_via_qr_code(env, &user1_auth, canister_ids.identity, link_code);
    client::identity::happy_path::accept_identity_link_via_qr_code(
        env,
        user2_auth_principal,
        canister_ids.identity,
        link_code,
        user2_public_key,
        true,
    );

    let auth_principals =
        client::identity::happy_path::auth_principals(env, user1_auth.auth_principal(), canister_ids.identity);

    assert_eq!(auth_principals.len(), 2);
}

#[test_case(false)]
#[test_case(true)]
fn flag_ii_principal(is_ii_principal: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let (auth_principal, public_key) = if is_ii_principal {
        random_internet_identity_principal()
    } else {
        let (a, p, _) = sign_in_with_email(env, canister_ids);
        (a, p)
    };

    let session_key = random::<[u8; 32]>().to_vec();

    client::identity::happy_path::create_identity(
        env,
        auth_principal,
        canister_ids.identity,
        public_key.clone(),
        session_key.clone(),
        is_ii_principal,
    );

    let auth_principals_response = client::identity::happy_path::auth_principals(env, auth_principal, canister_ids.identity);

    assert_eq!(auth_principals_response.len(), 1);
    assert_eq!(auth_principals_response.first().unwrap().is_ii_principal, is_ii_principal);
}

pub(crate) fn sign_in_with_email(env: &mut PocketIc, canister_ids: &CanisterIds) -> (Principal, Vec<u8>, SignedDelegation) {
    let email = format!("{}@test.com", random_string());
    let session_key = random::<[u8; 32]>().to_vec();

    let generate_magic_link_response = client::sign_in_with_email::generate_magic_link(
        env,
        Principal::anonymous(),
        canister_ids.sign_in_with_email,
        &sign_in_with_email_canister::generate_magic_link::Args {
            email: email.clone(),
            session_key: session_key.clone(),
            max_time_to_live: None,
        },
    );

    let sign_in_with_email_canister::generate_magic_link::Response::Success(generate_magic_link_success) =
        generate_magic_link_response
    else {
        panic!("{generate_magic_link_response:?}");
    };

    let magic_link = sign_in_with_email_test_utils::generate_magic_link(
        &email,
        session_key.clone(),
        generate_magic_link_success.created * NANOS_PER_MILLISECOND,
        generate_magic_link_success.expiration,
        generate_magic_link_success.code,
    );

    let handle_magic_link_response = client::sign_in_with_email::handle_magic_link(
        env,
        Principal::anonymous(),
        canister_ids.sign_in_with_email,
        &sign_in_with_email_canister::handle_magic_link::Args {
            link: format!("{}&c={}", magic_link.build_querystring(), magic_link.magic_link.code()),
        },
    );
    assert!(matches!(
        handle_magic_link_response,
        sign_in_with_email_canister::handle_magic_link::Response::Success
    ));

    let get_delegation_response = client::sign_in_with_email::get_delegation(
        env,
        Principal::anonymous(),
        canister_ids.sign_in_with_email,
        &sign_in_with_email_canister::get_delegation::Args {
            email: email.to_string(),
            session_key,
            expiration: generate_magic_link_success.expiration,
        },
    );

    let sign_in_with_email_canister::get_delegation::Response::Success(delegation) = get_delegation_response else {
        panic!("{get_delegation_response:?}");
    };

    let principal = Principal::self_authenticating(&generate_magic_link_success.user_key);
    let public_key = generate_magic_link_success.user_key;
    let delegation = SignedDelegation {
        delegation: Delegation {
            pubkey: delegation.delegation.pubkey,
            expiration: delegation.delegation.expiration,
        },
        signature: delegation.signature,
    };

    (principal, public_key, delegation)
}
