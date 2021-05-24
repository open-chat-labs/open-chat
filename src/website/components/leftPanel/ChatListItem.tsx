import React from "react";
import { useDispatch } from "react-redux";
import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import Typography from "@material-ui/core/Typography";
import { alpha } from "@material-ui/core/styles/colorManipulator";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import { gotoChatByIndex } from "../../actions/chats/gotoChat";
import { Option } from "../../domain/model/common";
import { UserId } from "../../domain/model/users";
import { formatMessageDate } from "../../formatters/date";
import ParticipantsTyping from "../shared/ParticipantsTyping";
import TextContent from "../shared/TextContent";
import ThemTyping from "../shared/ThemTyping";
import DefaultGroupChatIcon from "../shared/DefaultGroupChatIcon";
import UserAvatar from "../shared/UserAvatar";

type Props = {
    name: string,
    date?: Date,
    index: number,
    selected: boolean,
    latestMessage: string,
    isGroup: boolean,
    userId: Option<UserId>,
    userImageId: Option<string>,
    unreadCount: number,
    themTyping: boolean,
    userOnline: boolean,
    participantsTyping: string[]
}

const useStyles = makeStyles<Theme, Props>((theme: Theme) => ({
    listItem: {
        backgroundColor: theme.colors.sidePanel.backgroundColor,
        "&:hover": {
            backgroundColor: theme.colors.sidePanel.listItemHoverBackgroundColor,
            cursor: "pointer"
        },
        "&.Mui-selected": {
            backgroundColor: theme.colors.sidePanel.listItemSelectedBackgroundColor
        }
    },
    chatSummary: {
        paddingLeft: 10,
        width: "100%",
        minWidth: 0
    },
    chatName: {
        visibility: props => props.name.length ? "visible" : "hidden"
    },
    latestMessage: {
        color: alpha(theme.colors.textColor, 0.6),
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    date: {
        color: alpha(theme.colors.textColor, 0.6),
        float: "right"
    },
    unreadCount: {
        fontSize: "0.75rem",
        float: "right",
        backgroundColor: theme.colors.green.main,
        color: theme.colors.green.contrastText,
        lineHeight: "20px",
        borderRadius: 10,
        textAlign: "center",
        verticalAlign: "middle",
        minWidth: 20,
        padding: "0 4px"
    }
}));

export default React.memo(ChatListItem);

function ChatListItem(props: Props) {
    const dispatch = useDispatch();
    const classes = useStyles(props);

    const icon = props.isGroup
        ? <DefaultGroupChatIcon size="md" />
        : <UserAvatar
            isUserOnline={props.userOnline}
            userId={props.userId}
            imageId={props.userImageId}
            size="md" />;

    let snippet: JSX.Element;
    if (props.themTyping) {
        snippet = <ThemTyping variant="body2" />;
    } else if (props.participantsTyping.length) {
        snippet = <ParticipantsTyping usernames={props.participantsTyping} />
    } else {
        snippet = <TextContent text={props.latestMessage} plainText={true} variant="body2" />;
    }

    return (
        <ListItem selected={props.selected} onClick={() => dispatch(gotoChatByIndex(props.index))} className={classes.listItem} divider>
            <ListItemIcon>
                {icon}
            </ListItemIcon>
            <div className={classes.chatSummary}>
                <div>
                    <Typography variant="caption" className={classes.date}>{props.date ? formatMessageDate(props.date) : null}</Typography>
                    <Typography variant="body1" className={classes.chatName}>{props.name.length ? props.name : "Loading"}</Typography>
                </div>
                <div>
                    {props.unreadCount > 0 ? <div className={classes.unreadCount}>{props.unreadCount}</div> : null}
                    <div className={classes.latestMessage}>
                        {snippet}
                    </div>
                </div>
            </div>
        </ListItem>
    );
}
