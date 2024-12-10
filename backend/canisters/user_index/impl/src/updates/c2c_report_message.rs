use crate::{
    guards::caller_is_user_canister_or_group_index,
    model::{
        pending_modclub_submissions_queue::PendingModclubSubmission,
        reported_messages::{build_message_to_reporter, AddReportArgs, AddReportResult},
    },
    mutate_state, RuntimeState,
};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::deep_message_links;
use modclub_canister::submitHtmlContent::Level;
use types::{Chat, Message, MessageContent, MessageIndex};
use user_index_canister::c2c_report_message::{Response::*, *};

#[update(guard = "caller_is_user_canister_or_group_index", msgpack = true)]
#[trace]
fn c2c_report_message(args: Args) -> Response {
    mutate_state(|state| c2c_report_message_impl(args, state))
}

fn c2c_report_message_impl(args: Args, state: &mut RuntimeState) -> Response {
    let add_report_args = AddReportArgs {
        chat_id: args.chat_id,
        thread_root_message_index: args.thread_root_message_index,
        message_index: args.message.message_index,
        message_id: args.message.message_id,
        sender: args.message.sender,
        already_deleted: args.already_deleted,
        reporter: args.reporter,
        timestamp: state.env.now(),
    };
    let report_index = match state.data.reported_messages.add_report(add_report_args) {
        AddReportResult::New(report_index) => report_index,
        AddReportResult::ExistingOutcome(report_index) => {
            // Queue a message from the OC bot to the reporter describing what happened
            let reported_message = state.data.reported_messages.get(report_index).unwrap();
            state.push_event_to_local_user_index(args.reporter, build_message_to_reporter(reported_message, args.reporter));
            return Success;
        }
        AddReportResult::ExistingPending => return Success,
        AddReportResult::AlreadyReportedByUser => return AlreadyReported,
    };

    // Record the reported message against the sender's user record
    state.data.users.push_reported_message(args.message.sender, report_index);

    // Queue submission of the report to Modclub
    state.queue_modclub_submission(PendingModclubSubmission {
        report_index,
        title: construct_report_title(args.chat_id, args.thread_root_message_index, &args.message),
        html_report: construct_html_report(args.chat_id, args.thread_root_message_index, &args.message, args.is_public),
        level: Level::simple,
    });

    Success
}

fn construct_report_title(chat_id: Chat, thread_root_message_index: Option<MessageIndex>, message: &Message) -> String {
    // Use the message url as the title so we can find it from the modclub admin dashboard
    deep_message_links::build_message_link(chat_id, thread_root_message_index, message.message_index)
}

fn construct_html_report(
    chat_id: Chat,
    thread_root_message_index: Option<MessageIndex>,
    message: &Message,
    is_public: bool,
) -> String {
    let content = &message.content;

    let mut html = String::new();

    // 1. Media/file
    match content {
        MessageContent::Giphy(g) => {
            let (w, h) = impose_max_dimensions(g.desktop.height, g.desktop.height);
            html.push_str(&format!("<img width=\"{}\" height=\"{}\" src=\"{}\">\n", w, h, g.desktop.url));
        }
        MessageContent::Image(i) => {
            if let Some(br) = i.blob_reference.as_ref() {
                let (w, h) = impose_max_dimensions(i.width, i.height);
                html.push_str(&format!("<img width=\"{}\" height=\"{}\" src=\"{}\">\n", w, h, br.url()));
            }
        }
        MessageContent::Video(v) => {
            if let Some(br) = v.video_blob_reference.as_ref() {
                let (w, h) = impose_max_dimensions(v.width, v.height);
                let preload = v
                    .image_blob_reference
                    .as_ref()
                    .map(|b| format!(" preload=\"{}\"", b.url()))
                    .unwrap_or_default();
                html.push_str(&format!(
                    "<video{} width=\"{}\" height=\"{}\" controls><source src=\"{}\"></video>\n",
                    preload,
                    w,
                    h,
                    br.url()
                ));
            }
        }
        MessageContent::Audio(a) => {
            if let Some(br) = a.blob_reference.as_ref() {
                html.push_str(&format!("<audio controls src=\"{}\">\n", br.url()));
            }
        }
        MessageContent::File(f) => {
            if let Some(br) = f.blob_reference.as_ref() {
                html.push_str(&format!("<a href=\"{}\">link to file</a>\n", br.url()));
            }
        }
        _ => (),
    }

    // 2. Text/caption
    html.push_str(&markdown_to_html(&extract_text(content)));

    // 3. Message link
    if is_public {
        let message_link = deep_message_links::build_message_link(chat_id, thread_root_message_index, message.message_index);
        html.push_str(&format!("<a href=\"{}\">link to message</a>\n", message_link));
    }

    html
}

fn impose_max_dimensions(w: u32, h: u32) -> (u32, u32) {
    const MAX_W: u32 = 500;
    const MAX_H: u32 = 500;

    if w == 0 || h == 0 {
        (MAX_W, MAX_H)
    } else if w <= MAX_W && h <= MAX_H {
        (w, h)
    } else if w > h {
        (MAX_W, (h * MAX_W) / w)
    } else {
        ((w * MAX_H / h), MAX_H)
    }
}

fn extract_text(content: &MessageContent) -> String {
    let mut text = format!("{}\n\n", content.text().unwrap_or_default());

    if let MessageContent::Poll(p) = content {
        for o in p.config.options.iter() {
            text.push_str(&format!("- {}\n", o));
        }
    }

    text
}

fn markdown_to_html(markdown: &str) -> String {
    let parser = pulldown_cmark::Parser::new(markdown);
    let mut html_output = String::new();
    pulldown_cmark::html::push_html(&mut html_output, parser);
    html_output
}

#[cfg(test)]
mod tests {
    use candid::Principal;
    use types::{BlobReference, ChatId, ImageContent, TextContent, ThumbnailData, Tips, VideoContent};

    use super::*;

    #[test]
    fn create_report_from_text_message() {
        let chat_id: ChatId = Principal::from_text("2rgzm-4iaaa-aaaaf-aaa5a-cai").unwrap().into();
        let text = "## GitHub commit

https://github.com/open-chat-labs/open-chat/commit/e93865ea29b5bab8a9f0b01052938b84bb3371f2

## Description

- Support submitting proposals of type 'Upgrade SNS to next version'
- Support submitting proposals of type 'Add token'
- Final changes needed for disappearing messages (will be enabled soon)
- A few minor bugfixes"
            .to_string();

        let message = Message {
            message_index: 27461.into(),
            message_id: 188960262885472233086330058967164649472u128.into(),
            sender: Principal::from_text("3skqk-iqaaa-aaaaf-aaa3q-cai").unwrap().into(),
            content: types::MessageContent::Text(TextContent { text }),
            replies_to: None,
            reactions: Vec::new(),
            tips: Tips::default(),
            thread_summary: None,
            edited: false,
            forwarded: false,
            block_level_markdown: false,
        };

        let report = construct_html_report(Chat::Group(chat_id), None, &message, true);

        print!("{}", report);
    }

    #[test]
    fn create_report_from_image_message() {
        let chat = Chat::Channel(
            Principal::from_text("wowos-hyaaa-aaaar-ar4ca-cai").unwrap().into(),
            259630963639405604007172212966027535235u128.into(),
        );

        let message = Message {
            message_index: 72805.into(),
            message_id: 123356442671309293004896491442800689152u128.into(),
            sender: Principal::from_text("6oehr-mqaaa-aaaaf-ahlaa-cai").unwrap().into(),
            content: types::MessageContent::Image(ImageContent {
                width: 100,
                height: 50,
                thumbnail_data: ThumbnailData("blank".to_string()),
                caption: Some("It's over!".to_string()),
                mime_type: "image/png".to_string(),
                blob_reference: Some(BlobReference {
                    canister_id: Principal::from_text("m7ykd-3iaaa-aaaar-ad2uq-cai").unwrap(),
                    blob_id: 181941936258991437198326577112311764747,
                }),
            }),
            replies_to: None,
            reactions: Vec::new(),
            tips: Tips::default(),
            thread_summary: None,
            edited: false,
            forwarded: false,
            block_level_markdown: false,
        };

        let report = construct_html_report(chat, None, &message, true);

        print!("{}", report);
    }

    #[test]
    fn create_report_from_video_message() {
        let chat = Chat::Channel(
            Principal::from_text("wowos-hyaaa-aaaar-ar4ca-cai").unwrap().into(),
            259630963639405604007172212966027535235u128.into(),
        );

        let message = Message {
            message_index: 72805.into(),
            message_id: 123356442671309293004896491442800689152u128.into(),
            sender: Principal::from_text("6oehr-mqaaa-aaaaf-ahlaa-cai").unwrap().into(),
            content: types::MessageContent::Video(VideoContent {
                width: 200,
                height: 100,
                thumbnail_data: ThumbnailData("blank".to_string()),
                caption: Some("Hello world".to_string()),
                mime_type: "video/mpeg".to_string(),
                image_blob_reference: Some(BlobReference {
                    canister_id: Principal::from_text("m7ykd-3iaaa-aaaar-ad2uq-cai").unwrap(),
                    blob_id: 181941936277550442520330478250480023339,
                }),
                video_blob_reference: Some(BlobReference {
                    canister_id: Principal::from_text("m7ykd-3iaaa-aaaar-ad2uq-cai").unwrap(),
                    blob_id: 181941936239106898356555537109512322009,
                }),
            }),
            replies_to: None,
            reactions: Vec::new(),
            tips: Tips::default(),
            thread_summary: None,
            edited: false,
            forwarded: false,
            block_level_markdown: false,
        };

        let report = construct_html_report(chat, None, &message, true);

        print!("{}", report);
    }
}
