/**
 * Redesign test (task #20): routes the lucide icons that appear on the
 * conversation page to Raft's own icon set. Wired in vite.config.ts as an
 * alias for "lucide-react"; every other icon falls through to lucide.
 * Remove the alias to go back to lucide everywhere.
 */
import { forwardRef, type SVGProps } from "react";
import { RIcon, type RIconName } from "./icons";

export * from "lucide-react/icons";

type LucideLikeProps = SVGProps<SVGSVGElement> & { size?: number | string; strokeWidth?: number | string; absoluteStrokeWidth?: boolean };

function make(name: RIconName, lucideName: string) {
  const C = forwardRef<SVGSVGElement, LucideLikeProps>(({ size = 24, strokeWidth: _sw, absoluteStrokeWidth: _a, className, ...rest }, ref) => (
    <RIcon {...rest} ref={ref} name={name} width={size} height={size} className={["lucide", `lucide-${lucideName}`, className].filter(Boolean).join(" ")} />
  ));
  C.displayName = lucideName;
  return C;
}

export const CircleHelp = make("help", "circle-help");
export const PanelLeftClose = make("panel-left-close", "panel-left-close");
export const PanelLeftOpen = make("panel-left-open", "panel-left-open");
export const ArrowDownUp = make("sort", "arrow-down-up");
export const Bookmark = make("bookmark", "bookmark");
export const BookmarkMinus = make("bookmark-minus", "bookmark-minus");
export const Ellipsis = make("more", "ellipsis");
export const CornerUpLeft = make("reply", "corner-up-left");
export const Forward = make("forward", "forward");
export const SmilePlus = make("add-reaction", "smile-plus");
export const Bell = make("bell", "bell");
export const Hash = make("hash", "hash");
export const Lock = make("lock", "lock");
export const AtSign = make("at-sign", "at-sign");
export const ChevronRight = make("chevron-right", "chevron-right");
export const ChevronDown = make("chevron-down", "chevron-down");
export const Plus = make("plus", "plus");
export const X = make("close", "x");
export const ArrowDown = make("arrow-down", "arrow-down");
export const Check = make("check", "check");
export const Search = make("search", "search");
export const Paperclip = make("attach", "paperclip");
export const Users = make("users", "users");
export const User = make("user", "user");
export const MessageSquare = make("message", "message-square");
export const Inbox = make("inbox", "inbox");
export const ListTodo = make("tasks", "list-todo");
export const Plug = make("plug", "plug");
