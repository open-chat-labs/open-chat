use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{SelectedGroupUpdates, TimestampMillis};

#[ts_export(group, selected_updates)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub updates_since: TimestampMillis,
    // As for `selected_initial`, used if the details are returned in full (`SuccessSnapshot`)
    pub max_members: Option<u32>,
}

#[ts_export(group, selected_updates)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SelectedGroupUpdates),
    SuccessNoUpdates(TimestampMillis),
    // Some of the updates since `updates_since` are too old to have been kept, so the details are
    // returned in full instead, as `selected_initial` returns them
    SuccessSnapshot(crate::selected_initial::SuccessResult),
    Error(OCError),
}

#[cfg(test)]
mod tests {
    use super::*;

    // `Args` as they were before `max_members` was added
    #[derive(Serialize)]
    struct PreviousArgs {
        updates_since: TimestampMillis,
    }

    #[test]
    fn args_without_max_members_are_read() {
        let bytes = msgpack::serialize_then_unwrap(PreviousArgs { updates_since: 1 });
        let args: Args = msgpack::deserialize_then_unwrap(&bytes);
        assert!(args.max_members.is_none());
    }
}
