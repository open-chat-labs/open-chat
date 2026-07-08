use crate::guards::caller_is_governance_principal;
use crate::model::models::ModelRecord;
use crate::{RuntimeState, engine, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use personhood_verifier_canister::ModelKind;
use personhood_verifier_canister::commit_model::{Response::*, *};
use tracing::info;

// Activates a chunk-uploaded model, but only if the assembled bytes hash to
// exactly the value pinned in the (SNS proposal) payload. Committing an
// embedding model bumps the model version.
#[update(guard = "caller_is_governance_principal", candid = true, msgpack = true)]
#[trace]
fn commit_model(args: Args) -> Response {
    mutate_state(|state| commit_model_impl(args, state))
}

fn commit_model_impl(args: Args, state: &mut RuntimeState) -> Response {
    if !state.data.models.has_pending_upload(args.kind) {
        return NoPendingUpload;
    }
    if matches!(args.kind, ModelKind::Embedding) && args.version <= state.data.current_model_version {
        return VersionNotIncreasing {
            current: state.data.current_model_version,
        };
    }
    let bytes = state.data.models.assemble(args.kind);
    let actual = sha256::sha256_string(&bytes);
    if !actual.eq_ignore_ascii_case(&args.sha256) {
        return HashMismatch { actual };
    }
    if let Err(error) = engine::real::validate_model(&bytes, args.kind) {
        return InvalidModel(error);
    }

    let size = bytes.len() as u64;
    let now = state.env.now();
    state.data.models.record_commit(
        args.kind,
        ModelRecord {
            version: args.version,
            sha256: actual,
            size,
            committed_at: now,
        },
    );
    if matches!(args.kind, ModelKind::Embedding) {
        state.data.current_model_version = args.version;
    }
    // Force a rebuild so the new weights take effect immediately
    engine::real::drop_engines();
    if state.data.models.all_committed() {
        if let Err(error) = engine::real::build_engines(&state.data.models) {
            return InvalidModel(error);
        }
    }
    info!(kind = ?args.kind, version = args.version, size, "Model committed");
    Success { size }
}
