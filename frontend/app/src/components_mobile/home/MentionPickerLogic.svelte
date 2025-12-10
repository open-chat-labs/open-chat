<script lang="ts">
    import type { OpenChat, UserOrUserGroup } from "openchat-client";
    import { currentUserIdStore, mobileWidth } from "openchat-client";
    import { getContext, onMount, type Snippet } from "svelte";

    const client = getContext<OpenChat>("client");

    type Direction = "up" | "down";

    interface Props {
        prefix: string | undefined;
        offset?: number;
        direction?: Direction;
        border?: boolean;
        mentionSelf?: boolean;
        supportsUserGroups?: boolean;
        usersOnly?: boolean;
        inline?: boolean;
        onMention: (user: UserOrUserGroup) => void;
        children: Snippet<
            [
                (u: UserOrUserGroup) => string,
                (u: UserOrUserGroup) => void,
                UserOrUserGroup[],
                Direction,
                boolean,
                boolean,
                string,
                number,
            ]
        >;
    }

    let {
        prefix,
        offset = 0,
        direction = "up",
        border = false,
        mentionSelf = false,
        supportsUserGroups = false,
        usersOnly = false,
        inline = false,
        onMention,
        children,
    }: Props = $props();

    let index = $state(0);
    let usersAndGroups: UserOrUserGroup[] = $state([]);

    onMount(() => {
        usersAndGroups = Object.values(client.getUserLookupForMentions()).sort(
            (a: UserOrUserGroup, b: UserOrUserGroup) => {
                const order = { everyone: 1, user_group: 2, user: 3, bot: 4 };
                return order[a.kind] - order[b.kind];
            },
        );
    });

    function mention(userOrGroup: UserOrUserGroup) {
        onMention($state.snapshot(userOrGroup));
    }

    function compareMatchNames(a: string, b: string): number {
        // Order by length, then alphabetically
        if (a === b) return 0;
        if (a.length === b.length) {
            return a < b ? -1 : 1;
        }
        return a.length < b.length ? -1 : 1;
    }
    let itemHeight = $derived($mobileWidth ? 53 : 55);
    let borderWidth = $derived(direction === "up" ? 2 : 3);
    let maxHeight = $derived(
        direction === "down" ? `${3.2 * itemHeight + borderWidth}px` : "calc(var(--vh, 1vh) * 50)",
    );
    let prefixLower = $derived(prefix?.toLowerCase());
    let filtered = $derived(
        usersAndGroups
            .filter((userOrGroup) => {
                switch (userOrGroup.kind) {
                    case "user_group":
                        return (
                            !usersOnly &&
                            (prefixLower === undefined ||
                                (supportsUserGroups &&
                                    userOrGroup.name.toLowerCase().startsWith(prefixLower)))
                        );
                    case "everyone": {
                        return (
                            !usersOnly &&
                            (prefixLower === undefined || userOrGroup.kind.startsWith(prefixLower))
                        );
                    }
                    default:
                        return (
                            (mentionSelf || userOrGroup.userId !== $currentUserIdStore) &&
                            (prefixLower === undefined ||
                                userOrGroup.username.toLowerCase().startsWith(prefixLower) ||
                                userOrGroup.displayName?.toLowerCase().startsWith(prefixLower))
                        );
                }
            })
            .sort((a, b) => {
                // 'everyone' first, then user groups, then users
                if (a.kind === "everyone") return -1;
                if (b.kind === "everyone") return 1;

                if (a.kind === "user_group" && b.kind === "user_group") {
                    return compareMatchNames(a.name, b.name);
                }
                if (a.kind === "user" && b.kind === "user") {
                    return compareMatchNames(a.username, b.username);
                }
                return a.kind === "user_group" ? -1 : 1;
            }),
    );
    let style = $derived(
        direction === "up"
            ? `bottom: ${offset}px; height: ${
                  filtered.length * itemHeight + borderWidth
              }px; max-height: ${maxHeight}`
            : `top: ${offset}px; height: ${
                  filtered.length * itemHeight + borderWidth
              }px; max-height: ${maxHeight}`,
    );

    function userOrGroupKey(u: UserOrUserGroup): string {
        switch (u.kind) {
            case "user_group":
                return u.id.toString();
            case "everyone":
                return "everyone";
            default:
                return u.userId;
        }
    }
</script>

{@render children(userOrGroupKey, mention, filtered, direction, inline, border, style, index)}
