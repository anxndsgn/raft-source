/**
 * Redesign test (task #20): routes every lucide icon with a clear Raft
 * counterpart (Raft Icons, "Icons 20 · 重绘") to Raft's own icon set.
 * Wired in vite.config.ts as an alias for "lucide-react"; every other icon
 * falls through to lucide.
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
export const HelpCircle = make("help", "circle-help");
export const PanelLeftClose = make("panel-left-close", "panel-left-close");
export const PanelLeftOpen = make("panel-left-open", "panel-left-open");
export const ArrowDownUp = make("sort", "arrow-down-up");
export const Bookmark = make("bookmark", "bookmark");
export const BookmarkMinus = make("bookmark-minus", "bookmark-minus");
export const Ellipsis = make("more", "ellipsis");
export const MoreHorizontal = make("more", "ellipsis");
export const EllipsisVertical = make("more-vertical", "ellipsis-vertical");
export const CornerUpLeft = make("reply", "corner-up-left");
export const Reply = make("reply", "reply");
export const Forward = make("forward", "forward");
export const SmilePlus = make("add-reaction", "smile-plus");
export const Bell = make("bell", "bell");
export const BellOff = make("bell-off", "bell-off");
export const Hash = make("hash", "hash");
export const Lock = make("lock", "lock");
export const AtSign = make("at-sign", "at-sign");
export const ChevronRight = make("chevron-right", "chevron-right");
export const ChevronDown = make("chevron-down", "chevron-down");
export const ChevronLeft = make("chevron-left", "chevron-left");
export const ChevronUp = make("chevron-up", "chevron-up");
export const ArrowDown = make("arrow-down", "arrow-down");
export const ArrowUp = make("arrow-up", "arrow-up");
export const ArrowLeft = make("arrow-left", "arrow-left");
export const ArrowRight = make("arrow-right", "arrow-right");
export const ArrowUpRight = make("arrow-up-right", "arrow-up-right");
export const SquareArrowOutUpRight = make("open-full", "square-arrow-out-up-right");
export const Maximize2 = make("maximize", "maximize-2");
export const Minimize2 = make("minimize", "minimize-2");
export const Plus = make("plus", "plus");
export const Minus = make("minus", "minus");
export const X = make("close", "x");
export const Check = make("check", "check");
export const CheckCheck = make("check-check", "check-check");
export const CircleCheck = make("circle-check", "circle-check");
export const CheckCircle2 = make("circle-check", "circle-check");
export const XCircle = make("circle-x", "circle-x");
export const CircleDot = make("circle-dot", "circle-dot");
export const CircleSlash = make("circle-slash", "circle-slash");
export const Ban = make("ban", "ban");
export const Info = make("info", "info");
export const TriangleAlert = make("warning", "triangle-alert");
export const AlertTriangle = make("warning", "triangle-alert");
export const Search = make("search", "search");
export const ZoomIn = make("zoom-in", "zoom-in");
export const ZoomOut = make("zoom-out", "zoom-out");
export const Paperclip = make("attach", "paperclip");
export const Image = make("image", "image");
export const Link = make("link", "link");
export const Users = make("users", "users");
export const UsersRound = make("users", "users-round");
export const User = make("user", "user");
export const UserRound = make("user", "user-round");
export const UserPlus = make("user-plus", "user-plus");
export const UserMinus = make("user-minus", "user-minus");
export const UserX = make("user-x", "user-x");
export const Bot = make("bot", "bot");
export const MessageSquare = make("message", "message-square");
export const MessagesSquare = make("thread", "messages-square");
export const Inbox = make("inbox", "inbox");
export const ListTodo = make("tasks", "list-todo");
export const Plug = make("plug", "plug");
export const Settings = make("settings", "settings");
export const SlidersHorizontal = make("settings", "sliders-horizontal");
export const Pencil = make("pencil", "pencil");
export const Trash2 = make("trash", "trash-2");
export const Copy = make("copy", "copy");
export const Download = make("download", "download");
export const Upload = make("upload", "upload");
export const RefreshCw = make("refresh", "refresh-cw");
export const Undo2 = make("undo", "undo-2");
export const Send = make("send", "send");
export const Monitor = make("computer", "monitor");
export const Smartphone = make("smartphone", "smartphone");
export const Globe = make("globe", "globe");
export const FileText = make("file-text", "file-text");
export const File = make("file", "file");
export const KeyRound = make("key", "key-round");
export const Clock = make("clock", "clock");
export const Archive = make("archive", "archive");
export const Mail = make("mail", "mail");
export const FolderClosed = make("folder", "folder-closed");
export const AppWindow = make("app-window", "app-window");
export const ListFilter = make("list-filter", "list-filter");
export const Eye = make("eye", "eye");
export const Square = make("square", "square");
export const Play = make("play", "play");
export const Pause = make("pause", "pause");
export const Star = make("star", "star");
export const Flag = make("flag", "flag");
export const Pin = make("pin", "pin");
export const Tag = make("tag", "tag");
export const Cloud = make("cloud", "cloud");
export const Moon = make("moon", "moon");
export const House = make("house", "house");
export const Home = make("house", "house");
export const CalendarCheck = make("calendar-check", "calendar-check");
export const List = make("list", "list");
export const PanelRight = make("panel-right", "panel-right");
export const Rows3 = make("rows-3", "rows-3");
export const Columns3 = make("columns-3", "columns-3");
export const LayoutGrid = make("layout-grid", "layout-grid");
export const Code = make("code", "code");
export const Code2 = make("code", "code-xml");
export const Terminal = make("terminal", "terminal");
export const SquareTerminal = make("terminal", "square-terminal");
