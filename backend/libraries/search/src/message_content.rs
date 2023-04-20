use crate::document::Document;
use types::{CompletedCryptoTransaction, CryptoTransaction, MessageContentInternal};

impl From<&MessageContentInternal> for Document {
    fn from(message_content: &MessageContentInternal) -> Self {
        let mut document = Document::default();

        fn try_add_caption(document: &mut Document, caption_option: Option<&String>) {
            if let Some(caption) = caption_option {
                document.add_field(caption.to_owned(), 1.0);
            }
        }

        fn try_add_caption_and_mime_type(document: &mut Document, caption_option: Option<&String>, mime_type: &str) {
            document.add_field(mime_type.to_owned(), 1.0);
            try_add_caption(document, caption_option);
        }

        match message_content {
            MessageContentInternal::Text(c) => {
                document.add_field(c.text.clone(), 1.0);
            }
            MessageContentInternal::Crypto(c) => {
                let token = c.transfer.token();
                document.add_field(token.token_symbol(), 1.0);

                if let CryptoTransaction::Completed(c) = &c.transfer {
                    let amount_string = match c {
                        CompletedCryptoTransaction::NNS(t) => {
                            format!("{}", t.amount)
                        }
                        CompletedCryptoTransaction::SNS(t) => {
                            format!("{}", t.amount)
                        }
                    };
                    document.add_field(amount_string, 1.0);
                }

                try_add_caption(&mut document, c.caption.as_ref())
            }
            MessageContentInternal::Image(c) => try_add_caption_and_mime_type(&mut document, c.caption.as_ref(), &c.mime_type),
            MessageContentInternal::Video(c) => try_add_caption_and_mime_type(&mut document, c.caption.as_ref(), &c.mime_type),
            MessageContentInternal::Audio(c) => try_add_caption_and_mime_type(&mut document, c.caption.as_ref(), &c.mime_type),
            MessageContentInternal::File(c) => try_add_caption_and_mime_type(&mut document, c.caption.as_ref(), &c.mime_type),
            MessageContentInternal::Giphy(c) => try_add_caption(&mut document, c.caption.as_ref()),
            MessageContentInternal::Poll(p) => {
                document.add_field("poll".to_string(), 1.0);
                if let Some(text) = p.config.text.clone() {
                    document.add_field(text, 1.0);
                }
            }
            MessageContentInternal::GovernanceProposal(p) => {
                document.add_field(p.proposal.title().to_string(), 1.0);
                document.add_field(p.proposal.summary().to_string(), 1.0);
            }
            MessageContentInternal::Deleted(_) => {}
            MessageContentInternal::Prize(c) => {
                document.add_field(c.transaction.token().token_symbol(), 1.0);
                try_add_caption(&mut document, c.caption.as_ref())
            }
            MessageContentInternal::PrizeWinner(c) => {
                document.add_field(c.transaction.token().token_symbol(), 1.0);
            }
            MessageContentInternal::MessageReminderCreated(r) => try_add_caption(&mut document, r.notes.as_ref()),
            MessageContentInternal::MessageReminder(r) => try_add_caption(&mut document, r.notes.as_ref()),
            MessageContentInternal::Custom(c) => {
                document.add_field(c.kind.clone(), 1.0);
            }
        }

        document
    }
}
