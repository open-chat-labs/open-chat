//! The commit a canister was built from, baked in at compile time.
//!
//! This lives in its own dependency-free crate, used only by the canister impl crates, because
//! cargo rebuilds a crate whenever an env var it reads via `option_env!` changes. Keeping the
//! commit id out of shared libraries means a new commit only invalidates this crate and the
//! canisters themselves, so every library stays cached.

pub fn git_commit_id() -> &'static str {
    option_env!("GIT_COMMIT_ID").unwrap_or("'GIT_COMMIT_ID' environment variable not defined")
}
