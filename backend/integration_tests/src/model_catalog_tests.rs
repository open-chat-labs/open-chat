use crate::env::ENV;
use crate::{TestEnv, client};
use registry_canister::set_model_catalog::Response::*;
use std::ops::Deref;
use testing::rng::random_principal;
use types::{Modality, ModelCatalog, ModelCatalogEntry, ModelFile, ModelRuntime};

// Owner-configurable on-device model catalog (PR-cat-1). Exercises the full owner path through the
// deployed registry canister: the platform-operator auth gate on set_model_catalog, structural
// validation, and the set -> read-back round-trip via model_catalog.

fn valid_catalog() -> ModelCatalog {
    ModelCatalog {
        catalog_version: 1,
        models: vec![ModelCatalogEntry {
            id: "gemma-3-1b".to_string(),
            name: "Gemma 3 1B".to_string(),
            description: "Small on-device instruct model".to_string(),
            modalities: vec![Modality::Text],
            runtime: ModelRuntime::LlamaCpp,
            files: vec![ModelFile {
                url: "https://huggingface.co/org/repo/resolve/main/model.gguf".to_string(),
                sha256: "a".repeat(64),
                bytes: 1000,
            }],
            license: "gemma".to_string(),
            license_url: "https://ai.google.dev/gemma/terms".to_string(),
            size_bytes: 1000,
        }],
    }
}

#[test]
fn owner_sets_and_reads_model_catalog_with_auth() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user = client::register_user(env, canister_ids);

    // 1. A non-operator caller cannot set the catalog.
    let resp = client::registry::set_model_catalog(
        env,
        user.principal,
        canister_ids.registry,
        &registry_canister::set_model_catalog::Args { catalog: valid_catalog() },
    );
    assert!(matches!(resp, NotAuthorized), "non-operator expected NotAuthorized, got {resp:?}");

    // Nothing was stored, so the query still reports the empty default.
    let registry_canister::model_catalog::Response::Success(before) = client::registry::model_catalog(
        env,
        random_principal(),
        canister_ids.registry,
        &registry_canister::model_catalog::Args {},
    );
    assert!(before.models.is_empty(), "catalog should still be empty, got {before:?}");

    // 2. Grant platform-operator; the same call now succeeds.
    client::user_index::happy_path::add_platform_operator(env, *controller, canister_ids.user_index, user.user_id);
    env.tick();

    let resp = client::registry::set_model_catalog(
        env,
        user.principal,
        canister_ids.registry,
        &registry_canister::set_model_catalog::Args { catalog: valid_catalog() },
    );
    assert!(matches!(resp, Success), "operator set expected Success, got {resp:?}");

    // 3. An INVALID catalog (size_bytes != sum of file bytes) is rejected AFTER auth passes.
    let mut bad = valid_catalog();
    bad.models[0].size_bytes = 999;
    let resp = client::registry::set_model_catalog(
        env,
        user.principal,
        canister_ids.registry,
        &registry_canister::set_model_catalog::Args { catalog: bad },
    );
    assert!(matches!(resp, InvalidCatalog(_)), "invalid catalog expected InvalidCatalog, got {resp:?}");

    // 4. The query returns exactly what the operator set — NOT the rejected invalid catalog.
    let registry_canister::model_catalog::Response::Success(cat) = client::registry::model_catalog(
        env,
        random_principal(),
        canister_ids.registry,
        &registry_canister::model_catalog::Args {},
    );
    assert_eq!(cat.catalog_version, 1);
    assert_eq!(cat.models.len(), 1);
    assert_eq!(cat.models[0].id, "gemma-3-1b");
    assert_eq!(cat.models[0].files[0].bytes, 1000);
    assert_eq!(cat.models[0].size_bytes, 1000);
}
