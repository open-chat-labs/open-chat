use crate::{RuntimeState, calc_chunk_count, mutate_state};
use canister_tracing_macros::trace;
use ic_cdk::update;
use storage_bucket_canister::vault_file_chunk::{Response::*, *};

const VAULT_CHUNK_SIZE_BYTES: u32 = 1 << 20; // 1MB

// Streams a quarantined blob to an allowlisted vault reviewer. Deliberately an update call (not
// a query) so that fetching cannot happen outside a logged session: chunk 0 is the deliberate
// "Review" act — it is logged and opens a sequential read session — and later chunks are served
// only in session order, so no bytes are ever fetched unlogged while log growth stays bounded
// to review acts.
#[update]
#[trace]
fn vault_file_chunk(args: Args) -> Response {
    mutate_state(|state| vault_file_chunk_impl(args, state))
}

fn vault_file_chunk_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    let is_authority_reporter = state.data.vault.is_authority_reporter(&caller);
    if !is_authority_reporter && !state.data.vault.is_reviewer(&caller) {
        return NotAuthorized;
    }

    // The service's principal alone exports nothing: it must present the signed vault-export
    // token a moderator minted, and only for a file that token names. The bucket cannot see
    // the attempt register, so within its 5-minute validity a token is replayable by the
    // service principal - the blast radius is re-exporting evidence the moderator already
    // authorised (known gap #4 in the design).
    let export_claims = if is_authority_reporter {
        let Some(oc_public_key_pem) = state.data.vault.oc_public_key_pem() else {
            return NotAuthorized;
        };
        let Some(token) = args.vault_token.as_ref() else {
            return NotAuthorized;
        };
        let Ok(claims) =
            jwt::verify_and_decode::<types::NcaVaultExportClaims>(token, oc_public_key_pem, types::CLAIM_TYPE_NCA_VAULT_EXPORT)
        else {
            return NotAuthorized;
        };
        if claims.exp_ms() < state.env.now() {
            return NotAuthorized;
        }
        let claims = claims.into_custom();
        if !claims.files.iter().any(|f| f.blob_id == args.file_id) {
            return NotAuthorized;
        }
        Some(claims)
    } else {
        None
    };

    let Some((hash, mime_type)) = state
        .data
        .vault
        .record_for_file(&args.file_id)
        .map(|r| (r.hash, r.mime_type.clone()))
    else {
        return NotFound;
    };
    let Some(total_size) = state.data.files.data_size(&hash) else {
        return NotFound;
    };

    let chunk_count = calc_chunk_count(VAULT_CHUNK_SIZE_BYTES, total_size);
    if args.chunk_index >= chunk_count {
        return NotFound;
    }

    let now = state.env.now();
    let authorized = if let Some(claims) = export_claims {
        state.data.vault.authorize_export(
            args.file_id,
            caller,
            args.chunk_index,
            chunk_count,
            claims.report_index,
            Some(claims.user_id),
            now,
        )
    } else {
        state
            .data
            .vault
            .authorize_view(args.file_id, caller, args.chunk_index, chunk_count, now)
    };
    if !authorized {
        return SessionRequired;
    }

    let start = (args.chunk_index as usize) * (VAULT_CHUNK_SIZE_BYTES as usize);
    let end = std::cmp::min(start + VAULT_CHUNK_SIZE_BYTES as usize, total_size as usize);
    let Some(bytes) = state.data.files.blob_range(&hash, start, end) else {
        return NotFound;
    };

    Success(SuccessResult {
        bytes,
        chunk_index: args.chunk_index,
        chunk_count,
        total_size,
        mime_type,
    })
}
