use proc_macro::TokenStream;
use quote::quote;
use syn::{parse_macro_input, parse_quote, Item, Type};

#[proc_macro_attribute]
pub fn ts_optional(_attr: TokenStream, item: TokenStream) -> TokenStream {
    let mut item = parse_macro_input!(item as Item);
    if let Item::Struct(s) = &mut item {
        for field in s.fields.iter_mut() {
            if let Type::Path(type_path) = &mut field.ty {
                if type_path.qself.is_none()
                    && type_path.path.leading_colon.is_none()
                    && type_path.path.segments.len() == 1
                    && type_path.path.segments[0].ident == "Option"
                {
                    field.attrs.push(parse_quote!( #[ts(optional)] ));
                    field
                        .attrs
                        .push(parse_quote!( #[serde(skip_serializing_if = "Option::is_none")] ));
                }
            }
        }
    }
    TokenStream::from(quote! {
        #item
    })
}
