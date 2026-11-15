import { createContext } from "react";

/**
 * Team page PRD v2.0 §5.4 (T1/T3 with the column, Figmama 11/16): a member's details in the column beside the
 * Team page's lists show their profile alone — no tab row — until ⤢ expands them to the whole page with every tab.
 */
export const ProfileCompactContext = createContext(false);
