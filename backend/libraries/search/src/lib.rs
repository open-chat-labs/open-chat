use serde::{Deserialize, Serialize};
use std::cmp::max_by;

pub struct Query {
    pub tokens: Vec<Token>,
}

#[derive(Serialize, Deserialize)]
pub struct Token {
    pub value: String,
    pub value_lower: String,
}

impl Token {
    fn new(text: String) -> Token {
        let value_lower = text.to_lowercase();
        Token {
            value: text,
            value_lower,
        }
    }
}

impl Query {
    pub fn parse(free_text: String) -> Query {
        Query {
            tokens: parse_tokens(free_text),
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct Field {
    tokens: Vec<Token>,
    weight: f32,
}

impl Field {
    fn new(free_text: String, weight: f32, split: bool) -> Field {
        Field {
            tokens: if split { parse_tokens(free_text) } else { vec![Token::new(free_text)] },
            weight,
        }
    }
}

#[derive(Serialize, Deserialize, Default)]
pub struct Document {
    fields: Vec<Field>,
}

impl Document {
    pub fn add_field(&mut self, value: String, weight: f32, split: bool) -> &mut Document {
        self.fields.push(Field::new(value, weight, split));
        self
    }

    // Returns true if every token in the query matches the document, else false
    pub fn is_match(&self, query: &Query) -> bool {
        if query.tokens.is_empty() {
            return false;
        }
        for token in query.tokens.iter() {
            let mut matches = false;
            for field in &self.fields {
                if score_field_for_token(token, field) > 0.0 {
                    matches = true;
                    break;
                }
            }
            if !matches {
                return false;
            }
        }
        true
    }

    // The search term is split into words and each word is matched against each field
    // There is a match if at least one word matches at least one field case insensitive
    // Extra weight is given:
    // 1. for matching all words
    // 2. for matching all fields
    // 3. for case-sensitive matches
    // 4. the shorter the matching field(s)
    // 5. if the word matches the start of the field
    // A score of zero means no match
    pub fn calculate_score(&self, query: &Query) -> u32 {
        (self.calculate_score_internal(query) * 10000.0) as u32
    }

    fn calculate_score_internal(&self, query: &Query) -> f32 {
        let mut score = 0.0;

        for field in &self.fields {
            score += score_field(query, field);
        }

        score
    }
}

fn score_field(query: &Query, field: &Field) -> f32 {
    if query.tokens.is_empty() {
        return 0.0;
    }

    let mut total = 0.0;

    for token in &query.tokens {
        total += score_field_for_token(token, field);
    }

    // Average of token matches
    let score = total / (query.tokens.len() as f32);

    score * field.weight
}

fn score_field_for_token(search_token: &Token, field: &Field) -> f32 {
    let mut max_score: f32 = 0.0;

    // Max of token matches
    for field_token in &field.tokens {
        let score = score_token_match(search_token, field_token) * calculate_length_boost(field_token.value.len() as f32);
        max_score = max_by(max_score, score, |a, b| a.partial_cmp(b).unwrap());
    }

    max_score
}

fn score_token_match(search_token: &Token, field_token: &Token) -> f32 {
    if field_token.value.starts_with(&search_token.value) {
        2.0
    } else if field_token.value_lower.starts_with(&search_token.value_lower) {
        1.6
    } else if field_token.value.contains(&search_token.value) {
        1.5
    } else if field_token.value_lower.contains(&search_token.value_lower) {
        1.0
    } else {
        0.0
    }
}

fn calculate_length_boost(x: f32) -> f32 {
    1.0 + 0.5 * (-x / 20.0).exp()
}

fn parse_tokens(text: String) -> Vec<Token> {
    text.split_whitespace().map(|word| Token::new(word.to_string())).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_matching_two_words_in_long_text_better_than_one_word_in_short_text() {
        let mut doc1 = Document::default();
        doc1.add_field("The quick brown fox jumps over the lazy dog.".to_string(), 1.0, false);

        let mut doc2 = Document::default();
        doc2.add_field("fox".to_string(), 1.0, false);

        let query = Query::parse("lazy fox".to_string());

        assert!(doc1.calculate_score(&query) > doc2.calculate_score(&query));
    }
}
