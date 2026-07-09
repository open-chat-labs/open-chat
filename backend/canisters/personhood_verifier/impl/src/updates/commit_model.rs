use crate::guards::caller_is_governance_principal;
use crate::model::models::ModelRecord;
use crate::{RuntimeState, engine, jobs, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::DAY_IN_MS;
use personhood_verifier_canister::ModelKind;
use personhood_verifier_canister::commit_model::{Response::*, *};
use tracing::{error, info};
use types::{CanisterId, TimestampMillis};

// Re-verification window announced when an embedding model upgrade lapses
// older proofs
const LAPSE_WINDOW: u64 = 90 * DAY_IN_MS;

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
    let previous_embedding_version = if matches!(args.kind, ModelKind::Embedding) {
        state.data.models.committed(ModelKind::Embedding).map(|r| r.version)
    } else {
        None
    };
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
        // Upgrading the embedding model starts the re-verification window:
        // proofs and embeddings of the previous version lapse at the deadline
        if let Some(previous_version) = previous_embedding_version {
            let lapses_at = now + LAPSE_WINDOW;
            state.data.lapsed_embedding_purge = Some((previous_version, lapses_at));
            jobs::purge_lapsed_embeddings::restart_job(state);
            ic_cdk::futures::spawn(notify_user_index(state.data.user_index_canister_id, args.version, lapses_at));
        }
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

async fn notify_user_index(user_index_canister_id: CanisterId, new_version: u16, previous_lapses_at: TimestampMillis) {
    let args = user_index_canister::c2c_notify_model_upgraded::Args {
        new_version,
        previous_lapses_at,
    };
    for _ in 0..3 {
        match user_index_canister_c2c_client::c2c_notify_model_upgraded(user_index_canister_id, &args).await {
            Ok(_) => return,
            Err(err) => {
                error!(?err, "Failed to notify user_index of model upgrade");
            }
        }
    }
}
