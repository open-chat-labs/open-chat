// What the suite uses of the app's OC_E2E hook (app/src/utils/openchatClient.ts): the user's own
// OpenChat client. Only the members the suite calls are declared, in the shapes it relies on.
type GroupId = { kind: "group_chat"; groupId: string };

declare global {
    interface Window {
        __ocTest?: {
            client: {
                getCurrentUser(): Promise<{ kind: string; userId?: string }>;
                createCandidateGroup(
                    level: "group",
                    embeddedContent: boolean,
                ): Record<string, unknown> & { name: string };
                createGroup(
                    candidate: Record<string, unknown>,
                    invitees: string[],
                ): Promise<{ kind: string; chatId?: GroupId }>;
                setSelectedChat(chatId: GroupId, ...rest: unknown[]): Promise<void>;
                isPreviewing(chatId: GroupId): boolean;
            };
        };
        /** The app's last call to `setSelectedChat`, where a spec records it */
        __ocSelecting?: Promise<void>;
    }
}

export {};
