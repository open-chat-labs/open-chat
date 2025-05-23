use crate::{DEFAULT_CHUNK_SIZE_BYTES, RuntimeState, read_state};
use canister_api_macros::query;
use canister_tracing_macros::trace;
use storage_index_canister::ProjectedAllowance;
use storage_index_canister::allocated_bucket_v2::{Response::*, *};
use utils::file_id::generate_file_id;

#[query(candid = true, json = true, msgpack = true)]
#[trace]
fn allocated_bucket_v2(args: Args) -> Response {
    read_state(|state| allocated_bucket_impl(args, state))
}

fn allocated_bucket_impl(args: Args, state: &RuntimeState) -> Response {
    let user_id = state.env.caller();
    if let Some(user) = state.data.users.get(&user_id) {
        let byte_limit = user.byte_limit;
        let bytes_used = user.bytes_used;
        let bytes_used_after_upload = if state.data.files.user_owns_blob(user_id, args.file_hash) {
            bytes_used
        } else {
            bytes_used
                .checked_add(args.file_size)
                .unwrap_or_else(|| panic!("'bytes_used' overflowed for {user_id}"))
        };

        if bytes_used_after_upload > byte_limit && !user.delete_oldest_if_limit_exceeded {
            return AllowanceExceeded(ProjectedAllowance {
                byte_limit,
                bytes_used,
                bytes_used_after_upload,
                bytes_used_after_operation: bytes_used_after_upload,
            });
        }

        let now = state.env.now();
        let bucket = state
            .data
            .files
            .bucket_for_blob(args.file_hash)
            .or_else(|| state.data.buckets.allocate(args.file_hash, now));

        if let Some(canister_id) = bucket {
            Success(SuccessResult {
                canister_id,
                file_id: generate_file_id(
                    canister_id,
                    user_id,
                    args.file_hash,
                    args.file_id_seed.unwrap_or_default(),
                    now,
                ),
                chunk_size: DEFAULT_CHUNK_SIZE_BYTES,
                byte_limit,
                bytes_used,
                bytes_used_after_upload,
                projected_allowance: ProjectedAllowance {
                    byte_limit,
                    bytes_used,
                    bytes_used_after_upload,
                    bytes_used_after_operation: bytes_used_after_upload,
                },
            })
        } else {
            BucketUnavailable
        }
    } else {
        UserNotFound
    }
}
