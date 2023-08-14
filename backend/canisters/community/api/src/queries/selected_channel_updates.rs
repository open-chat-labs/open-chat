use crate::selected_channel_updates_v2;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::SelectedGroupUpdates;

pub type Args = selected_channel_updates_v2::Args;

#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SelectedGroupUpdates),
    SuccessNoUpdates,
    PrivateCommunity,
    ChannelNotFound,
    PrivateChannel,
}

impl From<selected_channel_updates_v2::Response> for Response {
    fn from(value: selected_channel_updates_v2::Response) -> Self {
        match value {
            selected_channel_updates_v2::Response::Success(u) => Response::Success(u),
            selected_channel_updates_v2::Response::SuccessNoUpdates(_) => Response::SuccessNoUpdates,
            selected_channel_updates_v2::Response::PrivateCommunity => Response::PrivateCommunity,
            selected_channel_updates_v2::Response::ChannelNotFound => Response::ChannelNotFound,
            selected_channel_updates_v2::Response::PrivateChannel => Response::PrivateChannel,
        }
    }
}
