use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use user_canister::c2c_vote_on_proposal::{Response::*, *};

// Neurons are controlled by, or hot-keyed to, a principal. A User canister's user hot-keys their
// canister, so it votes with their neurons; every user of a MultiUser canister would share the
// canister's principal, so any of them could vote with neurons hot-keyed to it by another. Until
// neurons can be tied to one user, voting isn't offered here.
#[update(msgpack = true)]
#[trace]
async fn c2c_vote_on_proposal(_args: Args) -> Response {
    Error(OCErrorCode::InvalidRequest.with_message("Voting on proposals is not supported for users in MultiUser canisters"))
}
