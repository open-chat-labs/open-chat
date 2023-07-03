export type Themes = Record<string, Theme> & {
    light: Theme;
    dark: Theme;
};

export interface Theme {
    name: string;
    label: string;
    burst: boolean;
    mode: "light" | "dark"; // pick the one that makes the most sense for your theme

    bg: string;
    txt: string;
    "txt-light": string;
    bd: string;

    error: string;
    warn: string;
    accent: string;
    accentDarker: string;
    disabledTxt: string;
    primary: string;
    code: string;

    placeholder: string;

    progress: {
        bd: string;
    };

    unread: {
        mute: string;
    };

    collapsible: {
        closed: {
            header: {
                txt: string;
            };
        };
        open: {
            header: {
                arrow: string;
            };
        };
    };

    notificationBar: {
        bg: string;
        txt: string;
    };

    reaction: {
        bg: string;
        txt: string;
        me: string;
    };

    timeline: {
        txt: string;
        bg: string;
    };

    section: {
        bg: string;
    };

    "sub-section": {
        bg: string;
    };

    toast: {
        failure: {
            bg: string;
            txt: string;
        };
        success: {
            bg: string;
            txt: string;
        };
    };

    input: {
        bg: string;
        sh: string;
        accent: string;
    };

    members: {
        hv: string;
    };

    entry: {
        bg: string;
        input: {
            bg: string;
            sh: string;
        };
    };

    panel: {
        bg: string;

        left: {
            bg: string;
        };

        right: {
            bg: string;

            modal: string;
        };
    };

    avatar: {
        bg: string;
        sh: string;
    };

    chatSearch: {
        bg: string;
        sh: string;
    };

    chatSummary: {
        "bg-selected": string;
        hv: string;
        del: string;
    };

    spinner: string;

    menu: {
        bg: string;
        txt: string;
        warn: string;
        "disabled-txt": string;
        hv: string;
        sh: string;
        "inverted-sh": string;
        bd: string;
        separator: string;
    };

    button: {
        bg: string;
        hv: string;
        txt: string;
        disabled: string;
        spinner: string;
        "disabled-txt": string;
        "disabled-bd": string;
    };

    link: {
        underline: string;
    };

    modal: {
        filter: string;
        bg: string;
        bd: string;
    };

    modalPage: {
        bg: string;
        txt: string;
        sh: string;
        filter: string;
        "txt-sh": string;
    };

    currentChat: {
        msgs: {
            bg: string;
        };
        date: {
            bg: string;
            txt: string;
        };
        msg: {
            bg: string;
            muted: string;
            txt: string;
            inert: string;

            me: {
                bg: string;
                muted: string;
                txt: string;
                bd: string;
            };
        };
    };

    icon: {
        hv: string;
        txt: string;
        selected: string;
        inverted: {
            hv: string;
            txt: string;
        };
        msg: {
            hv: string;
        };
    };

    scrollbar: {
        bg: string;
    };

    findUser: {
        edit: {
            pill: {
                txt: string;
            };
        };
        add: {
            pill: {
                txt: string;
            };
        };
    };

    recommended: {
        bg: string;
    };

    toggle: {
        bg: string;
    };

    thread: {
        preview: {
            bg: string;
        };
    };

    vote: {
        yes: {
            color: string;
            hv: string;
        };
        no: {
            color: string;
            hv: string;
        };
        maybe: {
            color: string;
        };
    };

    markdown: {
        fg: {
            color: string;
            bright: string;
            muted: string;
        };
    };

    landing: {
        txt: string;
        "txt-light": string;
        bg: string;
        bd: string;

        context: {
            bg: string;
        };

        phone: {
            bd: string;
        };

        brag: {
            op: string;
        };

        launch: {
            bg: string;
        };

        header: {
            bg: string;
            txt: string;
            bd: string;
        };

        auth: {
            bg: string;
            txt: string;
        };

        roadmap: {
            bd: string;
        };
    };
}
