import { createContext } from "react";

/**
 * Team page PRD v2.0 §5.4 (T1/T3 with the column, Figmama 11/16): a member's details in the column beside the
 * Team page's lists show their profile alone — no tab row — until ⤢ expands them to the whole page with every tab.
 */
export const ProfileCompactContext = createContext(false);

/**
 * A member's details on the Team page, in its column or expanded over it (Figmama, Anna 11/16): the head ends in
 * ⋯ ⤢ ×, Stop and Restart in ⋯ with their words (no bare icons beside Collapse and Close), Message in the strip.
 */
export const ProfileTeamHeadContext = createContext(false);
