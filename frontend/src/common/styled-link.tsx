import {Typography} from "@mui/material";
import {Link, LinkProps} from "react-router-dom";
import React from "react";
import {FCWithChildren} from "../types";


// export const StyledLink: FCWithChildren<LinkProps & { linkTarget: string,content: string }> = ({content, linkTarget, children}, props) => {
export const StyledLink: FCWithChildren<{ linkTarget: string,content: string }> = ({content, linkTarget, children}) => {
    return (<Link
        to={linkTarget}
                  style={{textDecoration: 'none'}}>
        {children || (<Typography variant={"body1"}
                    color={"primary"}>{content}</Typography>)}
    </Link>)
}



