import React from "react";
import { ClientNode } from "../../execution-client/types";

export type FCWithChildren<P = {}> = React.FC<
  P & { children?: React.ReactNode }
>;

export interface Node extends ClientNode {
  name: string;
}
