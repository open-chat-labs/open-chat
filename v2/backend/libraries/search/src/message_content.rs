use crate::document::Document;
use types::MessageContent;

const TRILLION: u128 = 1_000_000_000_000;

impl From<&MessageContent> for Document {
    fn from(message_content: &MessageContent) -> Self {
        let mut document = Document::default();

        match message_content {
            MessageContent::Text(c) => {
                document.add_field(c.text.to_owned(), 1.0);
            }
            MessageContent::Cycles(c) => {
                if let Some(caption) = &c.caption {
                    document.add_field(caption.to_owned(), 1.0);
                }
                document.add_field("cycles".to_owned(), 0.1);
                document.add_field((c.amount / TRILLION).to_string(), 0.1);
            }
            MessageContent::Media(c) => {
                if let Some(caption) = &c.caption {
                    document.add_field(caption.to_owned(), 1.0);
                }
                document.add_field(c.mime_type.to_owned(), 0.1);
            }
            MessageContent::File(c) => {
                if let Some(caption) = &c.caption {
                    document.add_field(caption.to_owned(), 1.0);
                }
                document.add_field(c.mime_type.to_owned(), 0.1);
            }
        }

        document
    }
}
