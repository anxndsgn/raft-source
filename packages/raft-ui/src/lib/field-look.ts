/**
 * Raft redesign (Figmama 11/20): with a mouse a field (Input, Textarea, the
 * InputGroup box) is 5% ink with no edge, the control corner, 10px sides and
 * 14px words; focus is a 1px ink line inside it (no glow, no new fill), an
 * error the danger line. Spread after a field's own classes.
 */
export const fieldLookDesktop = [
  "md:pointer-fine:border-0 md:pointer-fine:bg-fill-medium md:pointer-fine:rounded-control md:pointer-fine:px-2.5 md:pointer-fine:text-[14px]",
  "md:pointer-fine:focus-visible:shadow-none md:pointer-fine:focus-visible:inset-ring md:pointer-fine:focus-visible:inset-ring-foreground",
  "md:pointer-fine:data-invalid:inset-ring md:pointer-fine:data-invalid:inset-ring-danger",
  "md:pointer-fine:disabled:bg-fill-medium md:pointer-fine:disabled:opacity-40",
];
