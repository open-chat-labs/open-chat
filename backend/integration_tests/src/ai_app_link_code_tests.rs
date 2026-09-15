use crate::TestEnv;
use crate::client;
use crate::env::ENV;
use crate::fan_out_delivery_tests;
use crate::wasms;
use candid::Principal;
use p256_key_pair::P256KeyPair;
use pocket_ic::PocketIc;
use rand::SeedableRng;
use rand::rngs::StdRng;
use std::ops::Deref;
use std::time::Duration;
use types::{AiAppId, AiAppRegistration, CanisterId, Empty};

fn register_per_user_app(
    env: &mut PocketIc,
    canister_ids: &crate::CanisterIds,
    controller: Principal,
    owner: &crate::User,
) -> AiAppRegistration {
    let inbox = client::create_canister(env, controller);
    let draft = fan_out_delivery_tests::register_per_user_app(env, canister_ids.user_index, controller, owner, Some(inbox));
    fan_out_delivery_tests::install_inbox_at(env, controller, canister_ids, inbox, draft.id, canister_ids.user_index);
    fan_out_delivery_tests::publish_registered_app(env, canister_ids.user_index, owner, draft.id)
}

fn app_canister(app: &AiAppRegistration) -> CanisterId {
    app.manifest.app_canister_id.expect("test app must pin its verifier canister")
}

fn create_link_code(env: &mut PocketIc, sender: Principal, user_index: CanisterId, app_id: AiAppId) -> String {
    let response = try_create_link_code(env, sender, user_index, app_id);
    match response {
        user_index_canister::create_ai_app_link_code::Response::Success(result) => result.code,
        other => panic!("expected a link code, got {other:?}"),
    }
}

fn try_create_link_code(
    env: &mut PocketIc,
    sender: Principal,
    user_index: CanisterId,
    app_id: AiAppId,
) -> user_index_canister::create_ai_app_link_code::Response {
    client::execute_msgpack_update(
        env,
        sender,
        user_index,
        "create_ai_app_link_code_msgpack",
        &user_index_canister::create_ai_app_link_code::Args { app_id },
    )
}

fn wait_for_link_code_after_entropy(env: &mut PocketIc, sender: Principal, user_index: CanisterId, app_id: AiAppId) -> String {
    // Poll the freshly scheduled bounded callback directly. Artificially crossing the watchdog
    // deadline first would test retry recovery rather than normal lifecycle readiness.
    for _ in 0..100 {
        env.tick();
        match try_create_link_code(env, sender, user_index, app_id) {
            user_index_canister::create_ai_app_link_code::Response::Success(result) => return result.code,
            user_index_canister::create_ai_app_link_code::Response::Error(_) => {}
            other => panic!("unexpected link-code response during entropy reseed: {other:?}"),
        }
    }
    panic!("fresh raw_rand reseed did not complete after snapshot restoration")
}

fn upgrade_user_index_same_wasm_while_stopped(env: &mut PocketIc, user_index: CanisterId, controller: Principal) {
    // PocketIC rate-limits repeated install_code calls per execution round. Recovery may
    // legitimately follow another upgrade, so cross a bounded simulated cooldown while the
    // canister remains stopped.
    for _ in 0..10 * 60 {
        env.advance_time(Duration::from_secs(1));
        env.tick();
    }
    env.upgrade_canister(
        user_index,
        wasms::USER_INDEX.module.clone().into(),
        candid::encode_one(user_index_canister::post_upgrade::Args {
            wasm_version: wasms::USER_INDEX.version,
        })
        .unwrap(),
        Some(controller),
    )
    .expect("same-Wasm recovery upgrade must succeed while the canister remains stopped");
}

fn wait_for_initial_entropy_without_issuing_a_bearer(env: &mut PocketIc, user_index: CanisterId) {
    for _ in 0..20 {
        env.tick();
        let response: user_index_canister::action_signing_keys::Response =
            client::execute_query(env, Principal::anonymous(), user_index, "action_signing_keys", &Empty {});
        if matches!(response, user_index_canister::action_signing_keys::Response::Success(_)) {
            return;
        }
    }
    panic!("fresh UserIndex entropy did not become ready before the snapshot drill")
}

fn assert_public_claim_rejected_at_ingress(
    env: &mut PocketIc,
    caller: Principal,
    user_index: CanisterId,
    code: String,
    public_key: String,
) {
    let rejection = env
        .update_call(
            user_index,
            caller,
            "claim_ai_app_link_code_msgpack",
            msgpack::serialize_then_unwrap(user_index_canister::claim_ai_app_link_code::Args { code, public_key }),
        )
        .expect_err("legacy browser link claims must be rejected at ingress");
    assert_eq!(rejection.reject_code, pocket_ic::RejectCode::CanisterReject);
    assert_eq!(rejection.error_code, pocket_ic::ErrorCode::CanisterRejectedMessage);
    assert_eq!(
        rejection.reject_message,
        format!("Error from Canister {user_index}: Canister rejected the message"),
        "only the deliberate inspect_message rejection satisfies this security assertion"
    );
}

fn c2c_claim(
    env: &mut PocketIc,
    app_canister: CanisterId,
    user_index: CanisterId,
    code: String,
    public_key: String,
) -> user_index_canister::c2c_claim_ai_app_link_code::Response {
    fan_out_delivery_tests::claim_link_code_via_app(
        env,
        app_canister,
        user_index,
        user_index_canister::c2c_claim_ai_app_link_code::Args { code, public_key },
    )
}

fn my_keys(env: &PocketIc, caller: Principal, user_index: CanisterId) -> Vec<types::AiAppUserKey> {
    let response: user_index_canister::my_ai_app_keys::Response = client::execute_msgpack_query(
        env,
        caller,
        user_index,
        "my_ai_app_keys_msgpack",
        &user_index_canister::my_ai_app_keys::Args {},
    );
    match response {
        user_index_canister::my_ai_app_keys::Response::Success(result) => result.keys,
    }
}

// Release gate for https://github.com/ktimam/open-chat/issues/51. Supported recovery is strictly
// stop -> load snapshot -> same-Wasm upgrade while stopped -> start. The upgrade installs a fresh
// logical lifecycle before any restored bearer can be used.
#[test]
fn restored_user_index_snapshot_never_reissues_a_link_bearer() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let app_id = register_per_user_app(env, canister_ids, *controller, &owner).id;
    let user_index_controller = canister_ids.openchat_installer;

    // Prove the pre-snapshot entropy epoch is ready without exposing or consuming a bearer. This
    // preserves the drill's snapshot-before-first-bearer invariant while avoiding a race with the
    // asynchronous raw_rand callback scheduled during UserIndex installation.
    wait_for_initial_entropy_without_issuing_a_bearer(env, canister_ids.user_index);

    env.stop_canister(canister_ids.user_index, Some(user_index_controller))
        .unwrap();
    let snapshot = env
        .take_canister_snapshot(canister_ids.user_index, Some(user_index_controller), None)
        .unwrap();
    env.start_canister(canister_ids.user_index, Some(user_index_controller))
        .unwrap();

    let first = create_link_code(env, owner.principal, canister_ids.user_index, app_id);

    env.stop_canister(canister_ids.user_index, Some(user_index_controller))
        .unwrap();
    env.load_canister_snapshot(canister_ids.user_index, Some(user_index_controller), snapshot.id)
        .unwrap();
    upgrade_user_index_same_wasm_while_stopped(env, canister_ids.user_index, user_index_controller);
    env.start_canister(canister_ids.user_index, Some(user_index_controller))
        .unwrap();

    assert!(matches!(
        try_create_link_code(env, owner.principal, canister_ids.user_index, app_id),
        user_index_canister::create_ai_app_link_code::Response::Error(_)
    ));
    let after_restore = wait_for_link_code_after_entropy(env, owner.principal, canister_ids.user_index, app_id);
    assert_ne!(
        first, after_restore,
        "a snapshot restore must not replay an already exposed link bearer"
    );
}

#[test]
fn restored_pending_entropy_timer_is_recreated_by_the_recovery_upgrade() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let app_id = register_per_user_app(env, canister_ids, *controller, &owner).id;
    let user_index_controller = canister_ids.openchat_installer;

    // post_upgrade schedules a zero-delay reseed. Snapshot it before another round consumes the
    // timer, then prove the mandatory same-Wasm recovery upgrade recreates lifecycle work.
    env.upgrade_canister(
        canister_ids.user_index,
        wasms::USER_INDEX.module.clone().into(),
        candid::encode_one(user_index_canister::post_upgrade::Args {
            wasm_version: wasms::USER_INDEX.version,
        })
        .unwrap(),
        Some(user_index_controller),
    )
    .unwrap();
    env.stop_canister(canister_ids.user_index, Some(user_index_controller))
        .unwrap();
    let snapshot = env
        .take_canister_snapshot(canister_ids.user_index, Some(user_index_controller), None)
        .unwrap();
    env.load_canister_snapshot(canister_ids.user_index, Some(user_index_controller), snapshot.id)
        .unwrap();
    upgrade_user_index_same_wasm_while_stopped(env, canister_ids.user_index, user_index_controller);
    env.start_canister(canister_ids.user_index, Some(user_index_controller))
        .unwrap();

    assert!(matches!(
        try_create_link_code(env, owner.principal, canister_ids.user_index, app_id),
        user_index_canister::create_ai_app_link_code::Response::Error(_)
    ));
    let code = wait_for_link_code_after_entropy(env, owner.principal, canister_ids.user_index, app_id);
    assert_eq!(code.len(), 64);
}

// Happy path: owner creates a code, the exact registered app canister claims it with a delivery key,
// and that key shows up in the owner's list. Browser claims stay fail-closed and cannot burn the
// code; a second authenticated claim is CodeNotFound (single-use).
#[test]
fn link_code_happy_path_is_single_use() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let app = register_per_user_app(env, canister_ids, *controller, &owner);
    let app_id = app.id;
    let app_canister = app_canister(&app);

    let mut rng = StdRng::seed_from_u64(101);
    let delivery_pem = P256KeyPair::new(&mut rng).public_key_pem().to_string();

    let code = create_link_code(env, owner.principal, canister_ids.user_index, app_id);
    assert_eq!(code.len(), 64, "claim token must carry 256 bits as lowercase hex");
    assert!(
        code.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b)),
        "claim token must use a copy-safe lowercase hex alphabet"
    );

    // A browser/other principal cannot turn a copied bearer into a binding, and the rejected call
    // does not consume the legitimate app's code.
    assert_public_claim_rejected_at_ingress(
        env,
        testing::rng::random_principal(),
        canister_ids.user_index,
        code.clone(),
        delivery_pem.clone(),
    );
    let claimed = c2c_claim(env, app_canister, canister_ids.user_index, code.clone(), delivery_pem.clone());
    assert!(
        matches!(
            &claimed,
            user_index_canister::c2c_claim_ai_app_link_code::Response::Success(result)
                if result.app_id == app_id
                    && result.app_canister_id == app_canister
                    && result.app_subject.len() == 32
                    && result.consumer_queue_selector.len() == 32
                    && result.key_version == 1
        ),
        "first app-authenticated claim must return the complete scoped binding: {claimed:?}"
    );

    // The key is registered for the CODE's (user, app) pair == the owner who created it.
    let keys = my_keys(env, owner.principal, canister_ids.user_index);
    assert!(
        keys.iter().any(|k| k.app_id == app_id && k.public_key == delivery_pem),
        "owner's key list must contain the claimed delivery key: {keys:?}"
    );

    // Single-use: the code is consumed, so re-claiming is CodeNotFound.
    assert!(
        matches!(
            c2c_claim(env, app_canister, canister_ids.user_index, code, delivery_pem),
            user_index_canister::c2c_claim_ai_app_link_code::Response::CodeNotFound
        ),
        "second claim of a consumed code must be CodeNotFound"
    );
}

// A code claimed after its 10-minute TTL is CodeExpired (distinct from CodeNotFound).
#[test]
fn link_code_expires_after_ttl() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let app = register_per_user_app(env, canister_ids, *controller, &owner);
    let app_id = app.id;

    let mut rng = StdRng::seed_from_u64(202);
    let delivery_pem = P256KeyPair::new(&mut rng).public_key_pem().to_string();

    let code = create_link_code(env, owner.principal, canister_ids.user_index, app_id);

    // Advance past the 10-minute TTL (add slack) and let the clock take effect.
    env.advance_time(Duration::from_secs(11 * 60));
    env.tick();

    assert!(
        matches!(
            c2c_claim(env, app_canister(&app), canister_ids.user_index, code, delivery_pem),
            user_index_canister::c2c_claim_ai_app_link_code::Response::CodeExpired
        ),
        "claim after TTL must be CodeExpired"
    );
}

// set_my_ai_app_key registers a key the caller owns; remove_my_ai_app_key removes it and is
// idempotent (removing an absent key still reports Success — a disconnect must always succeed).
#[test]
fn set_and_remove_my_key_is_idempotent() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let app_id = register_per_user_app(env, canister_ids, *controller, &owner).id;

    let mut rng = StdRng::seed_from_u64(303);
    let pem = P256KeyPair::new(&mut rng).public_key_pem().to_string();

    let set: user_index_canister::set_my_ai_app_key::Response = client::execute_msgpack_update(
        env,
        owner.principal,
        canister_ids.user_index,
        "set_my_ai_app_key_msgpack",
        &user_index_canister::set_my_ai_app_key::Args {
            app_id,
            public_key: pem.clone(),
        },
    );
    assert!(
        matches!(set, user_index_canister::set_my_ai_app_key::Response::Success),
        "set must Succeed: {set:?}"
    );

    assert!(
        my_keys(env, owner.principal, canister_ids.user_index)
            .iter()
            .any(|k| k.app_id == app_id && k.public_key == pem),
        "key list must contain the set key"
    );

    // set_my_ai_app_key for an unknown app id -> AppNotFound.
    let unknown: user_index_canister::set_my_ai_app_key::Response = client::execute_msgpack_update(
        env,
        owner.principal,
        canister_ids.user_index,
        "set_my_ai_app_key_msgpack",
        &user_index_canister::set_my_ai_app_key::Args {
            app_id: u32::MAX,
            public_key: pem.clone(),
        },
    );
    assert!(
        matches!(unknown, user_index_canister::set_my_ai_app_key::Response::AppNotFound),
        "set for unknown app must be AppNotFound, got {unknown:?}"
    );

    // Remove -> gone.
    let remove: user_index_canister::remove_my_ai_app_key::Response = client::execute_msgpack_update(
        env,
        owner.principal,
        canister_ids.user_index,
        "remove_my_ai_app_key_msgpack",
        &user_index_canister::remove_my_ai_app_key::Args { app_id },
    );
    assert!(
        matches!(remove, user_index_canister::remove_my_ai_app_key::Response::Success),
        "remove must Succeed"
    );
    assert!(
        !my_keys(env, owner.principal, canister_ids.user_index)
            .iter()
            .any(|k| k.app_id == app_id),
        "key must be gone after remove"
    );

    // Remove again (absent key) -> still Success (idempotent disconnect).
    let remove_again: user_index_canister::remove_my_ai_app_key::Response = client::execute_msgpack_update(
        env,
        owner.principal,
        canister_ids.user_index,
        "remove_my_ai_app_key_msgpack",
        &user_index_canister::remove_my_ai_app_key::Args { app_id },
    );
    assert!(
        matches!(remove_again, user_index_canister::remove_my_ai_app_key::Response::Success),
        "removing an absent key must still be Success (idempotent), got {remove_again:?}"
    );
}

// A claim whose public_key fails validation is rejected BEFORE the code store is touched, so the
// code is NOT burned: the same code subsequently claims with a valid key. A regression that
// reordered validation after claim() would silently consume codes on malformed requests.
#[test]
fn claim_with_invalid_key_does_not_burn_the_code() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let app = register_per_user_app(env, canister_ids, *controller, &owner);
    let app_id = app.id;
    let code = create_link_code(env, owner.principal, canister_ids.user_index, app_id);
    let app_canister = app_canister(&app);

    for invalid in [
        "-----BEGIN PUBLIC KEY-----\nnot-a-key\n-----END PUBLIC KEY-----\n",
        "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=\n-----END PUBLIC KEY-----\n",
    ] {
        assert!(
            matches!(
                c2c_claim(env, app_canister, canister_ids.user_index, code.clone(), invalid.to_string()),
                user_index_canister::c2c_claim_ai_app_link_code::Response::InvalidRequest(_)
            ),
            "malformed or non-P256 SPKI must be InvalidRequest"
        );
    }

    // The SAME code still claims with a valid key — the invalid attempt did not consume it.
    let mut rng = StdRng::seed_from_u64(404);
    let delivery_pem = P256KeyPair::new(&mut rng).public_key_pem().to_string();
    assert!(
        matches!(
            c2c_claim(env, app_canister, canister_ids.user_index, code, delivery_pem.clone()),
            user_index_canister::c2c_claim_ai_app_link_code::Response::Success(_)
        ),
        "claim with a valid key after a rejected invalid claim must Succeed (code not burned)"
    );

    // And the key landed for the code's (user, app) pair.
    assert!(
        my_keys(env, owner.principal, canister_ids.user_index)
            .iter()
            .any(|k| k.app_id == app_id && k.public_key == delivery_pem),
        "owner's key list must contain the delivery key"
    );
}

// A NEW code for the same (user, app) pair retires the prior one: only the latest code is claimable.
#[test]
fn new_link_code_retires_prior_code_for_same_pair() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let app = register_per_user_app(env, canister_ids, *controller, &owner);
    let app_id = app.id;

    let mut rng = StdRng::seed_from_u64(405);
    let delivery_pem = P256KeyPair::new(&mut rng).public_key_pem().to_string();

    let code1 = create_link_code(env, owner.principal, canister_ids.user_index, app_id);
    let code2 = create_link_code(env, owner.principal, canister_ids.user_index, app_id);

    // The retired first code is dead — reported exactly like a code that never existed.
    assert!(
        matches!(
            c2c_claim(env, app_canister(&app), canister_ids.user_index, code1, delivery_pem.clone()),
            user_index_canister::c2c_claim_ai_app_link_code::Response::CodeNotFound
        ),
        "a retired (superseded) code must be CodeNotFound"
    );
    // Only the LATEST code claims.
    assert!(
        matches!(
            c2c_claim(env, app_canister(&app), canister_ids.user_index, code2, delivery_pem.clone()),
            user_index_canister::c2c_claim_ai_app_link_code::Response::Success(_)
        ),
        "the replacement code must claim successfully"
    );
    assert!(
        my_keys(env, owner.principal, canister_ids.user_index)
            .iter()
            .any(|k| k.app_id == app_id && k.public_key == delivery_pem),
        "the key claimed via the replacement code must be registered"
    );
}

// Rotation: set_my_ai_app_key UPSERTS by (user, app) — the new key REPLACES the old (exactly one
// row remains) and the fan-out lookup only ever sees the latest key.
#[test]
fn set_my_ai_app_key_rotation_replaces_previous_key() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let app_id = register_per_user_app(env, canister_ids, *controller, &owner).id;

    let mut rng = StdRng::seed_from_u64(505);
    let key1 = P256KeyPair::new(&mut rng).public_key_pem().to_string();
    let key2 = P256KeyPair::new(&mut rng).public_key_pem().to_string();

    for key in [&key1, &key2] {
        let set: user_index_canister::set_my_ai_app_key::Response = client::execute_msgpack_update(
            env,
            owner.principal,
            canister_ids.user_index,
            "set_my_ai_app_key_msgpack",
            &user_index_canister::set_my_ai_app_key::Args {
                app_id,
                public_key: key.clone(),
            },
        );
        assert!(
            matches!(set, user_index_canister::set_my_ai_app_key::Response::Success),
            "set failed: {set:?}"
        );
    }

    // my_ai_app_keys: exactly ONE row for the app, and it is key2 (replaced, not appended).
    let rows: Vec<_> = my_keys(env, owner.principal, canister_ids.user_index)
        .into_iter()
        .filter(|k| k.app_id == app_id)
        .collect();
    assert_eq!(rows.len(), 1, "rotation must not leave a second row: {rows:?}");
    assert_eq!(rows[0].public_key, key2, "the LATEST key must have replaced the old one");

    // The fan-out lookup (what a proposer uses to address deposits) also returns ONLY key2 — a
    // lingering key1 would keep receiving fan-out envelopes after rotation.
    let response: user_index_canister::ai_app_user_keys::Response = client::execute_msgpack_query(
        env,
        owner.local_user_index,
        canister_ids.user_index,
        "ai_app_user_keys_msgpack",
        &user_index_canister::ai_app_user_keys::Args {
            app_id,
            user_ids: vec![owner.user_id],
        },
    );
    let user_index_canister::ai_app_user_keys::Response::Success(result) = response;
    assert_eq!(result.keys.len(), 1);
    assert_eq!(
        result.keys[0].public_key, key2,
        "fan-out lookup must resolve to the rotated key only"
    );
}

// App deletion immediately hides its keys and consumes outstanding link capabilities, while the
// bounded durable cleanup job removes the now-unreachable key rows.
#[test]
fn delete_ai_app_cleans_per_user_keys_and_outstanding_codes() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let app = register_per_user_app(env, canister_ids, *controller, &owner);
    let app_id = app.id;
    let app_canister = app_canister(&app);
    let name = app.manifest.name.clone();

    // Pair a delivery key via the claim path, and mint a SECOND, still-outstanding code.
    let mut rng = StdRng::seed_from_u64(406);
    let pem1 = P256KeyPair::new(&mut rng).public_key_pem().to_string();
    let code1 = create_link_code(env, owner.principal, canister_ids.user_index, app_id);
    assert!(matches!(
        c2c_claim(env, app_canister, canister_ids.user_index, code1, pem1.clone()),
        user_index_canister::c2c_claim_ai_app_link_code::Response::Success(_)
    ));
    let code2 = create_link_code(env, owner.principal, canister_ids.user_index, app_id);

    let deleted: user_index_canister::delete_ai_app::Response = client::execute_msgpack_update(
        env,
        owner.principal,
        canister_ids.user_index,
        "delete_ai_app_msgpack",
        &user_index_canister::delete_ai_app::Args { name },
    );
    assert!(matches!(deleted, user_index_canister::delete_ai_app::Response::Success));

    // The key is hidden from both the user's list and fan-out as soon as deletion succeeds.
    assert!(
        !my_keys(env, owner.principal, canister_ids.user_index)
            .iter()
            .any(|k| k.app_id == app_id && k.public_key == pem1),
        "delete_ai_app must hide the paired key immediately"
    );
    let user_index_canister::ai_app_user_keys::Response::Success(result) = client::execute_msgpack_query(
        env,
        owner.local_user_index,
        canister_ids.user_index,
        "ai_app_user_keys_msgpack",
        &user_index_canister::ai_app_user_keys::Args {
            app_id,
            user_ids: vec![owner.user_id],
        },
    );
    assert!(result.keys.is_empty(), "fan-out must not return a key queued for deletion");

    // A pending capability for the deleted app is consumed during the same update.
    let pem2 = P256KeyPair::new(&mut rng).public_key_pem().to_string();
    assert!(matches!(
        c2c_claim(env, app_canister, canister_ids.user_index, code2, pem2),
        user_index_canister::c2c_claim_ai_app_link_code::Response::CodeNotFound
    ));
}
