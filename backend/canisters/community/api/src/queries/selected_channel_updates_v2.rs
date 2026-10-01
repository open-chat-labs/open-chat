use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, SelectedGroupUpdates, TimestampMillis};

#[ts_export(community, selected_channel_updates)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub updates_since: TimestampMillis,
    // If set, the details are returned in full (`SuccessSnapshot`, holding the first page of
    // members as `selected_channel_initial` does) when some of the updates since `updates_since` have been
    // pruned. If not, the updates which haven't been are returned, as they were before clients
    // could read `SuccessSnapshot`.
    pub max_members: Option<u32>,
}

#[ts_export(community, selected_channel_updates)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SelectedGroupUpdates),
    SuccessNoUpdates(TimestampMillis),
    // Some of the updates since `updates_since` are too old to have been kept, so the details are
    // returned in full instead, as `selected_channel_initial` returns them
    SuccessSnapshot(crate::selected_channel_initial::SuccessResult),
    Error(OCError),
}

#[cfg(test)]
mod tests {
    use super::*;

    // `Args` as they were before `max_members` was added
    #[derive(Serialize)]
    struct PreviousArgs {
        channel_id: ChannelId,
        updates_since: TimestampMillis,
    }

    #[test]
    fn args_without_max_members_are_read() {
        let bytes = msgpack::serialize_then_unwrap(PreviousArgs {
            channel_id: 1u32.into(),
            updates_since: 1,
        });
        let args: Args = msgpack::deserialize_then_unwrap(&bytes);
        assert!(args.max_members.is_none());
    }
}
