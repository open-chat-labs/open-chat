use proc_macro::TokenStream;
use quote::{format_ident, quote};
use std::fmt::Write;
use syn::punctuated::Punctuated;
use syn::{parse_macro_input, parse_quote, Attribute, Field, Ident, Item, Token, Type};

struct MethodAttribute {
    canister_name: String,
    method_name: String,
}

#[proc_macro_attribute]
pub fn ts_export(attr: TokenStream, item: TokenStream) -> TokenStream {
    let mut item = parse_macro_input!(item as Item);
    let attr_inputs: Vec<_> = parse_macro_input!(attr with Punctuated::<Ident, Token![,]>::parse_terminated)
        .into_iter()
        .map(|i| i.to_string())
        .collect();

    let (export_to, prefix) = if !attr_inputs.is_empty() {
        assert_eq!(attr_inputs.len(), 2);

        let canister_name = attr_inputs.first().unwrap();
        let method_name = attr_inputs.last().unwrap();

        let export_to = format!("{}/{}/", convert_case(canister_name, false), convert_case(method_name, false));
        let prefix = format!("{}{}", convert_case(canister_name, false), convert_case(method_name, true));

        (export_to, Some(prefix))
    } else {
        ("shared/".to_string(), None)
    };

    match &mut item {
        Item::Struct(s) => {
            insert_container_attributes(&mut s.attrs, &s.ident, export_to, prefix);

            for field in s.fields.iter_mut() {
                insert_field_attributes(field);
            }
        }
        Item::Enum(e) => {
            insert_container_attributes(&mut e.attrs, &e.ident, export_to, prefix);

            for variant in e.variants.iter_mut() {
                for field in variant.fields.iter_mut() {
                    insert_field_attributes(field);
                }
            }
        }
        _ => unimplemented!(),
    }

    TokenStream::from(quote! {
        #item
    })
}

#[proc_macro]
pub fn generate_ts_method(input: TokenStream) -> TokenStream {
    let inputs = parse_macro_input!(input with Punctuated::<Ident, Token![,]>::parse_terminated)
        .into_iter()
        .map(|i| i.to_string())
        .collect();

    let attribute = get_method_attribute(inputs);

    let canister_module = format_ident!("{}_canister", attribute.canister_name);
    let method_name = format_ident!("{}", attribute.method_name);

    let tokens = quote! {
        <#canister_module::#method_name::Args as ::ts_rs::TS>::export_all_to("frontend/openchat-agent/tsBindings").unwrap();
        <#canister_module::#method_name::Response as ::ts_rs::TS>::export_all_to("frontend/openchat-agent/tsBindings").unwrap();
    };

    TokenStream::from(tokens)
}

fn insert_container_attributes(attrs: &mut Vec<Attribute>, ident: &Ident, export_to: String, prefix: Option<String>) {
    let mut to_prepend: Vec<Attribute> = vec![
        parse_quote!( #[derive(::serde::Serialize, ::serde::Deserialize, ::ts_rs::TS)] ),
        parse_quote!( #[ts(export_to = #export_to)] ),
    ];
    if let Some(p) = prefix {
        let type_name = ident.to_string();
        let rename = format!("{p}{type_name}");
        to_prepend.push(parse_quote!( #[ts(rename = #rename)] ));
    }
    for attr in to_prepend.into_iter().rev() {
        attrs.insert(0, attr);
    }
}

fn insert_field_attributes(field: &mut Field) {
    match &field.ty {
        Type::Path(type_path) => {
            if type_path.qself.is_none()
                && type_path.path.leading_colon.is_none()
                && type_path.path.segments.len() == 1
                && type_path.path.segments[0].ident == "Option"
            {
                field.attrs.push(parse_quote ! ( #[ts(optional)] ));
                field
                    .attrs
                    .push(parse_quote ! ( # [serde(skip_serializing_if = "Option::is_none")] ));
            } else if type_path.qself.is_none()
                && type_path.path.leading_colon.is_none()
                && type_path.path.segments.len() == 1
                && (type_path.path.segments[0].ident == "Principal" || type_path.path.segments[0].ident == "CanisterId")
            {
                field.attrs.push(parse_quote ! ( #[ts(as = "ts_export::PrincipalTS")] ));
            }
        }
        _ => {}
    }
}

fn get_method_attribute(inputs: Vec<String>) -> MethodAttribute {
    let first_arg = inputs.first().unwrap();
    let second_arg = inputs.get(1).unwrap();

    let canister_name = first_arg.to_string();
    let method_name = second_arg.to_string();

    MethodAttribute {
        canister_name,
        method_name,
    }
}

fn convert_case(s: &str, start_with_capital: bool) -> String {
    let mut result = String::new();
    let words = s.split('_');

    for word in words {
        if !start_with_capital && result.is_empty() {
            result.write_str(word).unwrap();
        } else {
            for (i, char) in word.chars().enumerate() {
                if i == 0 {
                    result.write_char(char.to_ascii_uppercase()).unwrap();
                } else {
                    result.write_char(char).unwrap();
                }
            }
        }
    }

    result
}
