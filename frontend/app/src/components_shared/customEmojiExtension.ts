import { Node, mergeAttributes } from "@tiptap/core";

export const CustomEmojiExtension = Node.create({
    name: "custom_emoji",
    group: "inline",
    inline: true,
    selectable: true,
    atom: true,

    addAttributes() {
        return {
            id: { default: null },
        };
    },

    parseHTML() {
        return [{ tag: "custom-emoji[data-id]" }];
    },

    renderHTML({ node, HTMLAttributes }) {
        return [
            "custom-emoji",
            mergeAttributes(HTMLAttributes, { "data-id": node.attrs.id }),
        ];
    },
});
