use crate::env::ENV;
use crate::utils::tick_many;
use crate::{TestEnv, client};
use personhood_verifier_canister::verification_status::Response as StatusResponse;
use std::ops::Deref;
use std::time::Duration;
use types::{Achievement, ChitEventType};

// Markers drive the deterministic test-mode engine: same group (marker / 4)
// produces correlated embeddings, variant (marker % 4) picks the similarity
// band. See personhood_verifier engine/stub.rs. The test env (and so the
// verifier's embedding store) is shared across tests, so every test must use
// its own marker group.
const HAPPY_PATH_FACE: u8 = 40; // group 10
const DUP_FACE: u8 = 60; // group 15, variant 0
const DUP_FACE_DUPLICATE: u8 = 61; // group 15, variant 1 - clear duplicate
const GRAY_FACE: u8 = 100; // group 25, variant 0
const GRAY_FACE_LOOKALIKE: u8 = 102; // group 25, variant 2 - gray zone
const PAIR_FACE_1: u8 = 80; // group 20
const PAIR_FACE_2: u8 = 120; // group 30

fn drive_to_terminal_status(
    env: &mut pocket_ic::PocketIc,
    sender: candid::Principal,
    canister_id: types::CanisterId,
    session_id: u128,
) -> StatusResponse {
    for _ in 0..20 {
        tick_many(env, 3);
        let status = client::personhood_verifier::happy_path::verification_status(env, sender, canister_id, session_id);
        match status {
            StatusResponse::Queued { .. } | StatusResponse::Processing | StatusResponse::NotSubmitted => {
                env.advance_time(Duration::from_millis(500));
            }
            terminal => return terminal,
        }
    }
    panic!("verification did not reach a terminal status");
}

#[test]
fn verification_happy_path_propagates_proof_and_achievement() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::register_user(env, canister_ids);

    let challenge =
        client::personhood_verifier::happy_path::start_verification(env, user.principal, canister_ids.personhood_verifier);
    assert!(!challenge.is_retry_round);
    assert!(challenge.challenge.len() >= 5);

    client::personhood_verifier::happy_path::upload_all_frames(
        env,
        user.principal,
        canister_ids.personhood_verifier,
        &challenge,
        HAPPY_PATH_FACE,
    );
    client::personhood_verifier::happy_path::submit_verification(
        env,
        user.principal,
        canister_ids.personhood_verifier,
        challenge.session_id,
    );

    let status = drive_to_terminal_status(env, user.principal, canister_ids.personhood_verifier, challenge.session_id);
    // Version 0 = the stub era, before any real model has been committed
    assert!(matches!(status, StatusResponse::Verified { model_version: 0 }), "{status:?}");

    // Proof recorded in user_index and surfaced on the current user
    tick_many(env, 5);
    let current_user = client::user_index::happy_path::current_user(env, user.principal, canister_ids.user_index);
    assert!(current_user.is_unique_person);

    // Proof reached the user canister and awarded the achievement
    let user_state = client::user::happy_path::initial_state(env, &user);
    assert!(
        user_state
            .achievements
            .iter()
            .any(|ev| if let ChitEventType::Achievement(a) = &ev.reason {
                matches!(a, Achievement::ProvedUniquePersonhood)
            } else {
                false
            })
    );

    // Starting again reports AlreadyVerified
    let response = client::personhood_verifier::start_verification(
        env,
        user.principal,
        canister_ids.personhood_verifier,
        &types::Empty {},
    );
    assert!(matches!(
        response,
        personhood_verifier_canister::start_verification::Response::AlreadyVerified
    ));
}

#[test]
fn duplicate_face_fails_with_not_unique() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user1 = client::register_user(env, canister_ids);
    let user2 = client::register_user(env, canister_ids);

    // user1 enrolls DUP_FACE
    let challenge =
        client::personhood_verifier::happy_path::start_verification(env, user1.principal, canister_ids.personhood_verifier);
    client::personhood_verifier::happy_path::upload_all_frames(
        env,
        user1.principal,
        canister_ids.personhood_verifier,
        &challenge,
        DUP_FACE,
    );
    client::personhood_verifier::happy_path::submit_verification(
        env,
        user1.principal,
        canister_ids.personhood_verifier,
        challenge.session_id,
    );
    let status = drive_to_terminal_status(env, user1.principal, canister_ids.personhood_verifier, challenge.session_id);
    assert!(matches!(status, StatusResponse::Verified { .. }), "{status:?}");

    // user2 presents a clear duplicate of DUP_FACE and must be rejected
    let challenge =
        client::personhood_verifier::happy_path::start_verification(env, user2.principal, canister_ids.personhood_verifier);
    client::personhood_verifier::happy_path::upload_all_frames(
        env,
        user2.principal,
        canister_ids.personhood_verifier,
        &challenge,
        DUP_FACE_DUPLICATE,
    );
    client::personhood_verifier::happy_path::submit_verification(
        env,
        user2.principal,
        canister_ids.personhood_verifier,
        challenge.session_id,
    );
    let status = drive_to_terminal_status(env, user2.principal, canister_ids.personhood_verifier, challenge.session_id);
    assert!(
        matches!(
            status,
            StatusResponse::Failed {
                reason: personhood_verifier_canister::VerificationFailureReason::NotUnique
            }
        ),
        "{status:?}"
    );

    tick_many(env, 5);
    let current_user = client::user_index::happy_path::current_user(env, user2.principal, canister_ids.user_index);
    assert!(!current_user.is_unique_person);
}

#[test]
fn gray_zone_offers_retry_then_hard_fails() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user1 = client::register_user(env, canister_ids);
    let user2 = client::register_user(env, canister_ids);

    // user1 enrolls GRAY_FACE
    let challenge =
        client::personhood_verifier::happy_path::start_verification(env, user1.principal, canister_ids.personhood_verifier);
    client::personhood_verifier::happy_path::upload_all_frames(
        env,
        user1.principal,
        canister_ids.personhood_verifier,
        &challenge,
        GRAY_FACE,
    );
    client::personhood_verifier::happy_path::submit_verification(
        env,
        user1.principal,
        canister_ids.personhood_verifier,
        challenge.session_id,
    );
    drive_to_terminal_status(env, user1.principal, canister_ids.personhood_verifier, challenge.session_id);

    // user2's face lands in the gray zone -> retry offered
    let challenge =
        client::personhood_verifier::happy_path::start_verification(env, user2.principal, canister_ids.personhood_verifier);
    client::personhood_verifier::happy_path::upload_all_frames(
        env,
        user2.principal,
        canister_ids.personhood_verifier,
        &challenge,
        GRAY_FACE_LOOKALIKE,
    );
    client::personhood_verifier::happy_path::submit_verification(
        env,
        user2.principal,
        canister_ids.personhood_verifier,
        challenge.session_id,
    );
    let status = drive_to_terminal_status(env, user2.principal, canister_ids.personhood_verifier, challenge.session_id);
    assert!(matches!(status, StatusResponse::RetryRequired { .. }), "{status:?}");

    // The retry round is longer and stricter; the same face now hard-fails
    let retry_challenge =
        client::personhood_verifier::happy_path::start_verification(env, user2.principal, canister_ids.personhood_verifier);
    assert!(retry_challenge.is_retry_round);
    assert!(retry_challenge.challenge.len() > challenge.challenge.len());

    client::personhood_verifier::happy_path::upload_all_frames(
        env,
        user2.principal,
        canister_ids.personhood_verifier,
        &retry_challenge,
        GRAY_FACE_LOOKALIKE,
    );
    client::personhood_verifier::happy_path::submit_verification(
        env,
        user2.principal,
        canister_ids.personhood_verifier,
        retry_challenge.session_id,
    );
    let status = drive_to_terminal_status(
        env,
        user2.principal,
        canister_ids.personhood_verifier,
        retry_challenge.session_id,
    );
    assert!(
        matches!(
            status,
            StatusResponse::Failed {
                reason: personhood_verifier_canister::VerificationFailureReason::NotUnique
            }
        ),
        "{status:?}"
    );
}

#[test]
fn two_different_faces_both_verify() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user1 = client::register_user(env, canister_ids);
    let user2 = client::register_user(env, canister_ids);

    for (user, marker) in [(&user1, PAIR_FACE_1), (&user2, PAIR_FACE_2)] {
        let challenge =
            client::personhood_verifier::happy_path::start_verification(env, user.principal, canister_ids.personhood_verifier);
        client::personhood_verifier::happy_path::upload_all_frames(
            env,
            user.principal,
            canister_ids.personhood_verifier,
            &challenge,
            marker,
        );
        client::personhood_verifier::happy_path::submit_verification(
            env,
            user.principal,
            canister_ids.personhood_verifier,
            challenge.session_id,
        );
        let status = drive_to_terminal_status(env, user.principal, canister_ids.personhood_verifier, challenge.session_id);
        assert!(matches!(status, StatusResponse::Verified { .. }), "{status:?}");
    }
}

#[test]
fn attempt_limit_enforced() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::register_user(env, canister_ids);

    // Burn 5 attempts by failing the challenge each time (0xFF marker)
    for _ in 0..5 {
        let challenge =
            client::personhood_verifier::happy_path::start_verification(env, user.principal, canister_ids.personhood_verifier);
        client::personhood_verifier::happy_path::upload_all_frames(
            env,
            user.principal,
            canister_ids.personhood_verifier,
            &challenge,
            0xFF,
        );
        client::personhood_verifier::happy_path::submit_verification(
            env,
            user.principal,
            canister_ids.personhood_verifier,
            challenge.session_id,
        );
        let status = drive_to_terminal_status(env, user.principal, canister_ids.personhood_verifier, challenge.session_id);
        assert!(
            matches!(
                status,
                StatusResponse::Failed {
                    reason: personhood_verifier_canister::VerificationFailureReason::ChallengeFailed
                }
            ),
            "{status:?}"
        );
    }

    let response = client::personhood_verifier::start_verification(
        env,
        user.principal,
        canister_ids.personhood_verifier,
        &types::Empty {},
    );
    assert!(matches!(
        response,
        personhood_verifier_canister::start_verification::Response::AttemptLimitReached { .. }
    ));
}
