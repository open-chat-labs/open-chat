use crate::Data;

pub enum CommonErrors {
    UnsupportedTokens(Vec<String>),
    PairNotSupported,
}

impl CommonErrors {
    pub(crate) fn build_response_message(&self, data: &Data) -> String {
        match self {
            CommonErrors::UnsupportedTokens(tokens) => {
                let mut message = "The following inputs were not recognised as supported tokens:".to_string();
                for token in tokens {
                    message.push_str(&format!("\n{token}"));
                }

                message.push_str("\n\nSupported tokens:");
                for token in data.supported_tokens() {
                    message.push_str(&format!("\n{token}"));
                }

                message
            }
            CommonErrors::PairNotSupported => todo!(),
        }
    }
}
