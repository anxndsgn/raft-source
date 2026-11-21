import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

/** How far down a drag must take the sheet to close it. */
const CLOSE_DISTANCE = 80;

/**
 * The bottom sheet's grab area (lib/bottom-sheet.ts, Figmama mobile spec
 * 11/21): a strip over the sheet's top, under its drawn handle, that a finger
 * drags down. The sheet follows the finger; let go far enough down (or with a
 * flick) and it closes the way Escape does, so every menu that closes on
 * Escape closes here too; otherwise it springs back. Only on a phone: from
 * 768px it isn't drawn.
 */
export function SheetDragHandle() {
  const drag = useRef<{ id: number; startY: number; lastY: number; lastT: number; v: number } | null>(null);

  const sheetOf = (el: HTMLElement) => el.parentElement as HTMLElement | null;

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // A pointer the browser no longer tracks: follow it without capture.
    }
    drag.current = { id: event.pointerId, startY: event.clientY, lastY: event.clientY, lastT: event.timeStamp, v: 0 };
    const sheet = sheetOf(event.currentTarget);
    if (sheet) sheet.style.transition = "none";
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    const dt = Math.max(1, event.timeStamp - d.lastT);
    d.v = (event.clientY - d.lastY) / dt;
    d.lastY = event.clientY;
    d.lastT = event.timeStamp;
    const sheet = sheetOf(event.currentTarget);
    if (sheet) sheet.style.transform = `translateY(${Math.max(0, event.clientY - d.startY)}px)`;
  };

  const finish = (event: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    drag.current = null;
    const sheet = sheetOf(event.currentTarget);
    if (!sheet) return;
    const distance = event.clientY - d.startY;
    const close = !cancelled && (distance > CLOSE_DISTANCE || (distance > 16 && d.v > 0.6));
    sheet.style.transition = "transform 150ms ease-out";
    if (close) {
      sheet.style.transform = "translateY(100%)";
      // A Select's popup keeps keys it gets for its list; its dismissal listens on the document.
      const target = sheet.matches("[data-slot=select-content]") ? document.body : sheet;
      target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }));
    } else {
      sheet.style.transform = "";
    }
    window.setTimeout(() => {
      if (!sheet.isConnected) return;
      sheet.style.transition = "";
      if (!close) sheet.style.transform = "";
    }, 160);
  };

  return (
    <div
      aria-hidden="true"
      data-slot="sheet-drag-handle"
      className="absolute inset-x-0 top-0 z-raised h-5 touch-none md:hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => finish(event, false)}
      onPointerCancel={(event) => finish(event, true)}
    />
  );
}
