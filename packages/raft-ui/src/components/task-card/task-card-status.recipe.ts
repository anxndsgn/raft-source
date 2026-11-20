import { tv } from "../../lib/tv";

export const taskCardStatus = tv({
  base: [
    "inline-flex min-w-0 shrink-0 touch-manipulation items-center",
    "transition-[filter,opacity] duration-100 outline-none",
    "data-[busy=true]:pointer-events-none data-[busy=true]:cursor-wait data-[busy=true]:opacity-dimmed data-[busy=true]:disabled:opacity-100",
    // Raft redesign (Figmama 11/20): the status pixel and its name, 6px apart,
    // muted regular 12; no tint, no outline, no sides.
    "h-[22px] gap-1.5 rounded-chip border-0 px-0 py-0",
    "font-sans text-[12px] leading-4 font-normal text-foreground-muted",
    "[&:not(:has([data-slot=task-card-status-label]))]:hidden",
    "**:data-[slot=task-card-status-label]:inline-flex **:data-[slot=task-card-status-label]:items-center [&_[data-slot=task-card-status-label]]:gap-1.5",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-3 [&_svg:not([data-slot=task-status-icon])]:-mx-0.5 [&_svg[data-slot=task-status-icon]]:size-2.5",
    "[button&]:cursor-pointer [button&]:enabled:hover:text-foreground [button&]:enabled:active:text-foreground",
    "disabled:cursor-default disabled:opacity-100",
    "focus-visible:shadow-focus",
  ],
});
