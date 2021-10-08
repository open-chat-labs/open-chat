use crate::document::Document;
use types::MessageContent;

const TRILLION: u128 = 1_000_000_000_000;

impl From<&MessageContent> for Document {
    fn from(message_content: &MessageContent) -> Self {
        let mut document = Document::default();

        fn try_add_caption(document: &mut Document, caption_option: Option<&String>) {
            if let Some(caption) = caption_option {
                document.add_field(caption.to_owned(), 1.0);
            }
        }

        fn try_add_caption_and_mime_type(document: &mut Document, caption_option: Option<&String>, mime_type: &str) {
            document.add_field(mime_type.to_owned(), 0.1);
            try_add_caption(document, caption_option);
        }

        match message_content {
            MessageContent::Text(c) => {
                document.add_field(c.text.to_owned(), 1.0);
            }
            MessageContent::Cycles(c) => {
                document.add_field("cycles".to_owned(), 0.1);
                document.add_field((c.amount / TRILLION).to_string(), 0.1);
                try_add_caption(&mut document, c.caption.as_ref())
            }
            MessageContent::Image(c) => try_add_caption_and_mime_type(&mut document, c.caption.as_ref(), &c.mime_type),
            MessageContent::Video(c) => try_add_caption_and_mime_type(&mut document, c.caption.as_ref(), &c.mime_type),
            MessageContent::Audio(c) => try_add_caption_and_mime_type(&mut document, c.caption.as_ref(), &c.mime_type),
            MessageContent::File(c) => try_add_caption_and_mime_type(&mut document, c.caption.as_ref(), &c.mime_type),
            MessageContent::Deleted(_) => {}
        }

        document
    }
}
