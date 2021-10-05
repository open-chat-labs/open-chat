import React, { useState } from "react";
import { useSelector } from "react-redux";
import Divider from "@material-ui/core/Divider";
import Grid from "@material-ui/core/Grid";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import { RootState } from "../reducers";
import { Option } from "../domain/model/common";
import LeftPanel from "./leftPanel/LeftPanel";
import MainPanel from "./mainPanel/MainPanel";
import RightPanel from "./rightPanel/RightPanel";
import { setupBackgroundTasks } from "../backgroundTasks";
import { LeftPanelType, MiddlePanelType, RightPanelType } from "../domain/model/panels";
import { ViewMode } from "../domain/model/viewMode";
import NotificationBar from "./NotificationBar";

export default App;

const useStyles = makeStyles((theme: Theme) => ({
    grid: {
        overflow: "hidden",
        backgroundColor: theme.colors.sidePanel.backgroundColor,
        flex: "1 0 auto",
    },
    left: {
        height: "100%",
        width: "40%",
        "&.rightPanelActive": {
            width: "30%"
        },
        "&.mobile": {
            width: "100%"
        }
    },
    main: {
        height: "100%",
        backgroundColor: theme.colors.mainPanel.backgroundColor,
        width: "60%",
        "&.rightPanelActive": {
            width: "40%"
        },
        "&.mobile": {
            width: "100%"
        }
    },
    right: {
        height: "100%",
        width: "30%",
        "&.mobile": {
            width: "100%"
        }
    },
    container: {
        height: "100%",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
    },
}));

function App() {
    const classes = useStyles();
    const panel = useSelector((state: RootState) => state.appState.panelState);
    const viewMode = useSelector((state: RootState) => state.appState.viewMode);
    const [gridHeight, setGridHeight] = useState("100%");

    setupBackgroundTasks();

    function buildLeftPanel(): Option<JSX.Element> {
        if (panel.leftPanel === LeftPanelType.None) {
            return null;
        }

        let className = classes.left;
        if (viewMode === ViewMode.Mobile) {
            className += " mobile";
        } else if (panel.rightPanel !== RightPanelType.None) {
            className += " rightPanelActive";
        }

        return (
            <>
                <Grid
                    item
                    container
                    direction="column"
                    wrap="nowrap"
                    className={className}>
                    <LeftPanel type={panel.leftPanel} />
                </Grid>
                <Divider orientation="vertical" flexItem />
            </>
        );
    }

    function buildMainPanel(): Option<JSX.Element>  {
        if (panel.middlePanel === MiddlePanelType.None) {
            return null;
        }

        let className = "main-panel " + classes.main;
        if (viewMode === ViewMode.Mobile) {
            className += " mobile";
        } else if (panel.rightPanel !== RightPanelType.None) {
            className += " rightPanelActive";
        }

        return (
            <Grid
                item
                container
                direction="column"
                className={className}>
                <MainPanel />
            </Grid>
        );
    }

    function buildRightPanel(): Option<JSX.Element>  {
        if (panel.rightPanel === RightPanelType.None) {
            return null;
        }

        let className = classes.right;
        if (viewMode === ViewMode.Mobile) {
            className += " mobile";
        }

        return (
            <>
                <Divider orientation="vertical" flexItem />
                <Grid
                    item
                    container
                    direction="column"
                    wrap="nowrap"
                    className={className}>
                    <RightPanel type={panel.rightPanel} />
                </Grid>
            </>
        );
    }

    function onNotificationBarRender(render: boolean) {
        return render 
            ? setGridHeight("calc(100% - 32px)")
            : setGridHeight("100%");
    }

    return (
        <div className={classes.container}>
            <NotificationBar onRender={onNotificationBarRender} />
            <Grid container wrap="nowrap" className={classes.grid} height={gridHeight}>
                {buildLeftPanel()}
                {buildMainPanel()}
                {buildRightPanel()}
            </Grid>            
        </div>
    );
}


