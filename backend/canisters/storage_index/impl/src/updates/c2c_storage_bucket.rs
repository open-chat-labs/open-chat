use crate::guards::caller_is_bucket;
use crate::updates::c2c_sync_bucket::{forward_csam_matches, repush_denylist_if_hash_known, update_bucket_figures};
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use storage_index_canister::StorageBucketEvent;
use storage_index_canister::c2c_storage_bucket::*;
use types::{FileRejected, FileRejectedReason};

// Must be fed by a single queue on each bucket: the idempotency check keeps one high-water mark per
// sender, so a batch retried from a second queue after a later batch from the first had landed
// would be dropped as already seen
#[update(guard = "caller_is_bucket", msgpack = true)]
#[trace]
fn c2c_storage_bucket(args: Args) -> Response {
    mutate_state(|state| c2c_storage_bucket_impl(args, state))
}

fn c2c_storage_bucket_impl(args: Args, state: &mut RuntimeState) -> Response {
    let bucket = state.env.caller();
    let mut files_added = Vec::new();
    let mut csam_matches = Vec::new();

    for event in args.events {
        let is_new = state
            .data
            .idempotency_checker
            .check(bucket, event.created_at, event.idempotency_id);

        match event.value {
            StorageBucketEvent::FileAdded(file) => {
                if is_new {
                    repush_denylist_if_hash_known(bucket, &file, state);
                    // Whether it was rejected is worked out below, for new and repeated files alike
                    let _ = state.data.add_file_reference(bucket, file.clone());
                }
                files_added.push(file);
            }
            StorageBucketEvent::FileRemoved(file) if is_new => state.data.remove_file_reference(bucket, file),
            StorageBucketEvent::CsamMatch(csam_match) if is_new => csam_matches.push(csam_match),
            StorageBucketEvent::CsamHashDenylisted(denylisted) if is_new => state.data.denylist_csam_hash(
                bucket,
                denylisted.hash,
                denylisted.report_index,
                denylisted.derived.unwrap_or(false),
            ),
            _ => {}
        }
    }

    forward_csam_matches(bucket, csam_matches, state);

    update_bucket_figures(
        bucket,
        args.heap_memory_used,
        args.stable_memory_used,
        args.total_file_bytes,
        state,
    );

    // Worked out from what the index holds now rather than from what this call applied, so that a
    // batch sent again because its reply was lost gets the same answer. A file added and removed in
    // the same batch is reported too, which the bucket ignores, as it no longer has the file.
    let files_rejected = files_added
        .into_iter()
        .filter(|file| !state.data.files.contains(file, bucket))
        .map(|file| FileRejected {
            file_id: file.file_id,
            reason: if state.data.users.contains_key(&file.meta_data.owner) {
                FileRejectedReason::AllowanceExceeded
            } else {
                FileRejectedReason::UserNotFound
            },
        })
        .collect();

    Response::Success(SuccessResult { files_rejected })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{Data, UserRecordInternal};
    use candid::Principal;
    use storage_index_canister::init::CyclesDispenserConfig;
    use types::{CanisterWasm, FileAdded, FileMetaData, FileRemoved, IdempotentEnvelope, TimestampMillis};
    use utils::env::test::TestEnv;

    #[test]
    fn events_already_seen_are_dropped() {
        let (mut state, user) = setup();
        let now = state.env.now();

        let added = file_added(1, user, now);
        let removed = StorageBucketEvent::FileRemoved(FileRemoved {
            file_id: 1,
            meta_data: FileMetaData {
                owner: user,
                created: now,
            },
        });

        c2c_storage_bucket_impl(
            args(vec![envelope(now, 1, added.clone()), envelope(now + 1, 2, removed)]),
            &mut state,
        );
        assert_eq!(state.data.users[&user].bytes_used, 0);

        // The addition sent again after the removal is one already seen, so the file stays removed
        c2c_storage_bucket_impl(args(vec![envelope(now, 1, added)]), &mut state);
        assert_eq!(state.data.users[&user].bytes_used, 0);
    }

    #[test]
    fn a_batch_sent_again_gets_the_same_rejections() {
        let (mut state, user) = setup();
        let now = state.env.now();
        let unknown_user = Principal::from_slice(&[3]);

        let batch = vec![
            envelope(now, 1, file_added(1, user, now)),
            envelope(now, 2, file_added(2, unknown_user, now)),
        ];

        for _ in 0..2 {
            let Response::Success(result) = c2c_storage_bucket_impl(args(batch.clone()), &mut state);
            assert_eq!(result.files_rejected.len(), 1);
            assert_eq!(result.files_rejected[0].file_id, 2);
            assert!(matches!(result.files_rejected[0].reason, FileRejectedReason::UserNotFound));
        }
        assert_eq!(state.data.users[&user].bytes_used, 100);
    }

    fn setup() -> (RuntimeState, Principal) {
        let bucket = Principal::from_slice(&[1]);
        let user = Principal::from_slice(&[2]);
        let env = TestEnv {
            caller: bucket,
            ..Default::default()
        };
        let mut data = Data::new(
            Vec::new(),
            Vec::new(),
            CanisterWasm::default(),
            CyclesDispenserConfig {
                canister_id: Principal::anonymous(),
                min_cycles_balance: 0,
            },
            Principal::anonymous(),
            true,
        );
        data.users.insert(
            user,
            UserRecordInternal {
                byte_limit: 1000,
                bytes_used: 0,
                delete_oldest_if_limit_exceeded: true,
            },
        );
        (RuntimeState::new(Box::new(env), data), user)
    }

    fn file_added(file_id: u128, owner: Principal, created: TimestampMillis) -> StorageBucketEvent {
        StorageBucketEvent::FileAdded(FileAdded {
            file_id,
            hash: [file_id as u8; 32],
            size: 100,
            meta_data: FileMetaData { owner, created },
        })
    }

    fn args(events: Vec<IdempotentEnvelope<StorageBucketEvent>>) -> Args {
        Args {
            events,
            heap_memory_used: 0,
            stable_memory_used: 0,
            total_file_bytes: 0,
        }
    }

    fn envelope(
        created_at: TimestampMillis,
        idempotency_id: u64,
        value: StorageBucketEvent,
    ) -> IdempotentEnvelope<StorageBucketEvent> {
        IdempotentEnvelope {
            created_at,
            idempotency_id,
            value,
        }
    }
}
