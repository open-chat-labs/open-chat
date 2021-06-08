import React from "react";
import { useSelector } from "react-redux";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import useTheme from "@material-ui/core/styles/useTheme";
import { EmojiData, Picker } from 'emoji-mart';
import { RootState } from "../../reducers";
import { ViewMode } from "../../domain/model/viewMode";

export default React.memo(EmojiPicker);

type Props = {
    onEmojiSelected: (text: string) => void
}

type StyleProps = {
    showSearch: boolean
}

const useStyles = makeStyles<Theme, StyleProps>((theme: Theme) => ({
    "@global": {
        ".emoji-mart": {
            backgroundColor: theme.colors.footer.backgroundColor + " !important",
            border: 0,
            borderRadius: 0
        },
        ".emoji-mart-search": {
            paddingBottom: 6,
            display: props => props.showSearch ? "block" : "none"
        },
        ".emoji-mart-search input": {
            paddingTop: 7,
            backgroundColor: theme.colors.textBox.backgroundColor + " !important",
            color: theme.colors.textBox.textColor + " !important"
        },
        ".emoji-mart-category-label": {
            top: -1
        },
        ".emoji-mart-category-label span": {
            backgroundColor: theme.colors.footer.backgroundColor + " !important",
            opacity: 0.9,
            color: theme.colors.footer.mutedColor + " !important"
        },
        ".emoji-mart-category .emoji-mart-emoji span": {
            cursor: "pointer"
        },
        ".emoji-mart-scroll": {
            height: 215
        }
    }
}));

function EmojiPicker(props: Props) {
    const currentViewMode = useSelector((state: RootState) => state.appState.viewMode);
    const styleProps = {
        showSearch: currentViewMode === ViewMode.Desktop
    };
    useStyles(styleProps);
    const theme = useTheme();

    return (
        <Picker
            title={"Pick your emoji..."}
            theme={theme.palette.mode}
            color="#d62c7d"
            onSelect={onSelectEmoji}
            autoFocus={styleProps.showSearch}
            showPreview={false}
            showSkinTones={false}
            emojiTooltip={true}
            emoji="point_up"
            emojiSize={28}
            perLine={3}
            native={true}
            style={{
                width: "100%"
            }}/>
    );

    function onSelectEmoji(emojiData: EmojiData) {
        if ("native" in emojiData) {
            props.onEmojiSelected(emojiData.native);
        }
    }
}

