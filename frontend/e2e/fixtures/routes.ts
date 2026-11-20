import type { User } from "./users";

/** Opens the direct chat with `userId`, by its URL. */
export async function openDirectChat(user: User, userId: string): Promise<void> {
    await user.page.goto(user.tree === "v3" ? `/chats/user/${userId}` : `/user/${userId}`);
}

/** Opens a group by its URL. */
export async function openGroup(user: User, groupId: string): Promise<void> {
    await user.page.goto(user.tree === "v3" ? `/chats/group/${groupId}` : `/group/${groupId}`);
}
