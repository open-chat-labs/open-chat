//! The user held by the User canister, which holds a single one, and by the MultiUser canister,
//! which holds many, along with the logic of the endpoints over that user which both canisters
//! share.
//!
//! `model` holds the state. Each model is the same in both canisters: the entries a model keeps in
//! the stable memory map are scoped to the user they belong to at the boundary of the map, so the
//! MultiUser canister only has to access a model within its user's key scope.
//!
//! `queries` and `updates` hold one function per endpoint, named as the endpoint is, over a `User`
//! plus its args, the time and whichever facts only the canister knows. Guards, resolving the
//! caller and the canister's own side effects stay in the canisters, which get anything they must
//! do afterwards back as data rather than through callbacks.

pub mod model;
pub mod openchat_bot;
pub mod queries;
pub mod updates;

pub use model::*;
