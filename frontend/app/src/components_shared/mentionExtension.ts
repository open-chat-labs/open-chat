import { Node, mergeAttributes } from "@tiptap/core";

export const MentionExtension = Node.create({
    name: "mention",
    group: "inline",
    inline: true,
    selectable: true,
    atom: true,

    addAttributes() {
        return {
            userId: { default: null },
            username: { default: null },
        };
    },

    parseHTML() {
        return [{ tag: "span[data-type='mention']" }];
    },

    renderHTML({ node, HTMLAttributes }) {
        return [
            "span",
            mergeAttributes(HTMLAttributes, {
                "data-type": "mention",
                "data-user-id": node.attrs.userId,
                class: "mention",
            }),
            `@${node.attrs.username}`,
        ];
    },
});
