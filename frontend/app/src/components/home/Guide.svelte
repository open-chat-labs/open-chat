<script lang="ts">
    import Shepherd from "shepherd.js";
    import { onMount } from "svelte";
    import page from "page";

    onMount(() => {
        const tour = new Shepherd.Tour({
            useModalOverlay: true,
            defaultStepOptions: {
                classes: "shadow-md bg-purple-dark",
                scrollTo: true,
            },
        });

        const cancel = {
            text: "Cancel",
            action: tour.cancel,
            secondary: true,
        };

        const previous = {
            text: "Previous",
            action: tour.back,
            secondary: true,
        };

        const next = {
            text: "Next",
            action: tour.next,
        };

        const cancelPrevNext = [cancel, previous, next];

        function waitForElement(selector: string): Promise<Element> {
            return new Promise<Element>((resolve) => {
                let dom = document.querySelector(selector);
                if (dom) {
                    resolve(dom);
                } else {
                    const obs = new MutationObserver(() => {
                        dom = document.getElementById(selector);
                        if (dom) {
                            obs.disconnect();
                            resolve(dom);
                        }
                    });
                    obs.observe(document.body, { childList: true, subtree: true });
                }
            });
        }

        tour.addStep({
            id: "welcome",
            text: "Welcome to Communities! A few things have changed. If you like, you can take this short tour to familiarise you with the new layout.",
            buttons: [
                {
                    text: "No thanks",
                    action: tour.cancel,
                    secondary: true,
                },
                {
                    text: "Start",
                    action: tour.next,
                },
            ],
        });

        tour.addStep({
            id: "main-menu",
            text: "This is the main menu and it contains all the important links and functions that are not related to a specific Community, Group or Channel.",
            attachTo: {
                element: ".top .left-nav-item:nth-child(1)",
                on: "right",
            },
            buttons: cancelPrevNext,
        });

        tour.addStep({
            id: "user-avatar",
            text: "This is your user avatar. If you click here, your profile will open in the right-hand panel as usual.",
            attachTo: {
                element: ".top .left-nav-item:nth-child(2)",
                on: "right",
            },
            buttons: cancelPrevNext,
        });

        tour.addStep({
            id: "direct-chats",
            text: "Chats are now partitioned. Click here to see your direct chats - that is your one-to-one chats with other users.",
            attachTo: {
                element: ".top .left-nav-item:nth-child(3)",
                on: "right",
            },
            buttons: cancelPrevNext,
        });

        tour.addStep({
            id: "group-chats",
            text: "Click here to see your group chats. It is still perfectly ok to have group chats that are not part of a community. These global group chats will appear here.",
            attachTo: {
                element: ".top .left-nav-item:nth-child(4)",
                on: "right",
            },
            buttons: cancelPrevNext,
        });

        tour.addStep({
            id: "favourite-chats",
            text: "Click here to see your favourite chats. If you prefer to have a single list of chats you can use the favourites list. By default, any chat that you previously had pinned will appear in your list of favourites, but you can add any direct chat, group chat or community channel to this list.",
            attachTo: {
                element: ".top .left-nav-item:nth-child(5)",
                on: "right",
            },
            buttons: cancelPrevNext,
        });

        tour.addStep({
            id: "expand-menu",
            text: "You can expand this left hand navigation panel if you like so that you can see the labels associated with each item. This might helps you orient yourself until you get used to things.",
            attachTo: {
                element: ".left-nav-item .expand",
                on: "right",
            },
            buttons: cancelPrevNext,
        });

        tour.addStep({
            id: "explore-menu",
            text: "To find Communities to join, enter the Community explorer by clicking here.",
            attachTo: {
                element: ".left-nav-item .explore",
                on: "right",
            },
            buttons: [
                cancel,
                previous,
                {
                    text: "Next",
                    action() {
                        this.getCurrentStep()?.getTarget()?.click();
                        tour.next();
                    },
                },
            ],
        });

        tour.addStep({
            id: "search-communities",
            text: "Use the search box to explore.",
            attachTo: {
                element: ".explore .search",
                on: "bottom",
            },
            beforeShowPromise() {
                return waitForElement("#community-search");
            },
            buttons: cancelPrevNext,
        });

        tour.addStep({
            id: "filter-communities",
            text: "Fine tune your search using the filter panel to the right.",
            attachTo: {
                element: ".explore .buttons",
                on: "bottom",
            },
            buttons: cancelPrevNext,
        });

        tour.addStep({
            id: "create-community",
            text: "To create a new community, click here.",
            attachTo: {
                element: ".explore .create button",
                on: "bottom",
            },
            buttons: [
                cancel,
                previous,
                {
                    text: "Next",
                    action() {
                        this.getCurrentStep()?.getTarget()?.click();
                        tour.next();
                    },
                },
            ],
        });

        tour.addStep({
            id: "community-details",
            text: "Fill in the basic details for the new Community",
            attachTo: {
                element: ".modal-content",
                on: "right",
            },
            beforeShowPromise() {
                return waitForElement("#modal-content");
            },
            buttons: [
                cancel,
                previous,
                {
                    text: "Next",
                    action() {
                        document.getElementById("community-modal-next")?.click();
                        tour.next();
                    },
                },
            ],
        });

        tour.addStep({
            id: "community-visibility",
            text: "Choose the visibility level of your Community and any required access gate.",
            attachTo: {
                element: ".modal-content",
                on: "right",
            },
            buttons: [
                cancel,
                previous,
                {
                    text: "Next",
                    action() {
                        document.getElementById("community-modal-next")?.click();
                        tour.next();
                    },
                },
            ],
        });

        tour.addStep({
            id: "community-rules",
            text: "Decide whether to define and enable custom rules which must be accepted before users can join your Community.",
            attachTo: {
                element: ".modal-content",
                on: "right",
            },
            buttons: [
                cancel,
                previous,
                {
                    text: "Next",
                    action() {
                        document.getElementById("community-modal-next")?.click();
                        tour.next();
                    },
                },
            ],
        });

        tour.addStep({
            id: "community-permissions",
            text: "Define the permissions for your new Community.",
            attachTo: {
                element: ".modal-content",
                on: "right",
            },
            buttons: [
                cancel,
                previous,
                {
                    text: "Next",
                    action() {
                        document.getElementById("community-modal-next")?.click();
                        tour.next();
                    },
                },
            ],
        });

        tour.addStep({
            id: "community-channels",
            text: "Define one or more default channels. When a user joins your Community they will automatically be added to all of the default channels you define. These channels can be configured in detail after the Community has been created.",
            attachTo: {
                element: ".modal-content",
                on: "right",
            },
            buttons: [
                cancel,
                previous,
                {
                    text: "Next",
                    action() {
                        document.getElementById("community-modal-next")?.click();
                        tour.next();
                    },
                },
            ],
        });

        tour.addStep({
            id: "community-invite",
            text: "Finally, you may choose to invite users to your Community. You can always defer this step and invite users later or allow them to discover the Community themselves.",
            attachTo: {
                element: ".modal-content",
                on: "right",
            },
            buttons: [
                cancel,
                previous,
                {
                    text: "Next",
                    action() {
                        document.getElementById("community-modal-cancel")?.click();
                        tour.next();
                    },
                },
            ],
        });

        tour.addStep({
            id: "convert-intro",
            text: "What if you have an existing group that you'd like to convert to a Community?",
            buttons: cancelPrevNext,
        });

        tour.addStep({
            id: "convert",
            text: "From the group menu, you can simply choose convert a group to a Community and we will take care of the rest.",
            attachTo: {
                element: ".modal-content",
                on: "right",
            },
            beforeShowPromise() {
                page("/group");
                return waitForElement("#chat-list-search").then((el) => {
                    (el as HTMLInputElement).value = "Demo group";
                    el.dispatchEvent(
                        new InputEvent("input", {
                            bubbles: true,
                            cancelable: true,
                        })
                    );
                    el.dispatchEvent(
                        new KeyboardEvent("keydown", {
                            key: "Enter",
                            keyCode: 13,
                        })
                    );
                    return waitForElement(".search-item-title:contains('Demo group')").then(
                        (el) => {
                            (el as HTMLDivElement).click();
                        }
                    );
                });
            },
            buttons: [
                cancel,
                previous,
                {
                    text: "Next",
                    action() {
                        document.getElementById("community-modal-cancel")?.click();
                        tour.next();
                    },
                },
            ],
        });

        tour.start();
    });
</script>

<style lang="scss">
</style>
