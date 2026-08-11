use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{MessageId, MessageIndex, UnitResult};

#[ts_export(group, report_message)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub delete: bool,
    // The reporter asserts the message contains child sexual abuse content: the auto-sanction
    // (quarantine + delete + suspend) is applied immediately, ahead of the human verdict
    #[serde(default)]
    pub csam: bool,
}

pub type Response = UnitResult;
