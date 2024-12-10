use serde::{Deserialize, Serialize};

pub struct Query {
    pub tokens: Vec<Token>,
}

#[derive(Serialize, Deserialize)]
pub struct Token(pub(crate) String);

impl Token {
    fn new(text: &str) -> Token {
        Token(text.to_lowercase())
    }
}

impl Query {
    pub fn new(text: &str) -> Query {
        Query {
            tokens: parse_tokens(text),
        }
    }
}

#[derive(Serialize, Deserialize, Default)]
pub struct Document(pub(crate) Vec<Token>);

impl Document {
    pub fn add_field(&mut self, value: &str) -> &mut Document {
        let lowercase = value.to_lowercase();
        if !self.0.iter().any(|f| f.0 == lowercase) {
            self.0.push(Token(lowercase));
        }
        self
    }

    // Returns true if every token in the query matches the document, else false
    pub fn is_match(&self, query: &Query) -> bool {
        if query.tokens.is_empty() {
            false
        } else {
            query.tokens.iter().all(|t| self.0.iter().any(|f| f.0.contains(&t.0)))
        }
    }
}

fn parse_tokens(text: &str) -> Vec<Token> {
    text.split_whitespace().map(Token::new).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use test_case::test_case;

    #[test_case(vec!["abc", "xyz"], "abc", true)]
    #[test_case(vec!["ab", "xyz"], "abc", false)]
    #[test_case(vec!["abc", "xyz"], "xy abc", true)]
    #[test_case(vec!["AbcDef ghIJkl"], "aBCdEF", true)]
    #[test_case(vec!["AbcDef ghIJkl"], "aBCdEFg", false)]
    #[test_case(vec!["AbcDef ghIJkl"], "aBCdEF Ijk", true)]
    fn simple_matches_found_correctly(doc_fields: Vec<&str>, query: &str, should_match: bool) {
        let mut doc = Document::default();
        for field in doc_fields {
            doc.add_field(field);
        }

        assert_eq!(doc.is_match(&Query::new(query)), should_match);
    }
}
