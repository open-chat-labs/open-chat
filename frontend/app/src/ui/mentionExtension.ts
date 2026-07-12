import { Node, mergeAttributes } from "@tiptap/core";

export const UserMentionExtension = Node.create({
    name: "user_mention",
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
        return [{ tag: "span[data-type='user_mention']" }];
    },

    renderHTML({ node, HTMLAttributes }) {
        return [
            "span",
            mergeAttributes(HTMLAttributes, {
                "data-type": "user_mention",
                "data-user-id": node.attrs.userId,
                class: "mention",
            }),
            `@${node.attrs.username}`,
        ];
    },
});

export const GroupMentionExtension = Node.create({
    name: "group_mention",
    group: "inline",
    inline: true,
    selectable: true,
    atom: true,

    addAttributes() {
        return {
            groupId: { default: null },
            groupname: { default: null },
        };
    },

    parseHTML() {
        return [{ tag: "span[data-type='group_mention']" }];
    },

    renderHTML({ node, HTMLAttributes }) {
        return [
            "span",
            mergeAttributes(HTMLAttributes, {
                "data-type": "group_mention",
                "data-group-id": node.attrs.groupId,
                class: "mention",
            }),
            `@${node.attrs.groupname}`,
        ];
    },
});
