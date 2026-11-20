import { InputGroup, InputGroupAddon, InputGroupInput } from "@botiverse/raft-ui";
import type { InputHTMLAttributes } from "react";
import { useMediaQuery } from "../../hooks/effectPrimitives";

type SlugInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & {
  className?: string;
  inputClassName?: string;
};

type PrefixedInputProps = SlugInputProps & {
  prefix: string;
};

export function PrefixedInput({
  prefix,
  className = "",
  inputClassName = "",
  ...props
}: PrefixedInputProps) {
  // Raft redesign (Figmama 11/21): with a mouse the prefix is part of the field, muted, right before the
  // text, with no box or divider of its own.
  const inline = useMediaQuery("(width >= 48rem) and (pointer: fine)");
  return (
    <InputGroup className={`w-full ${className}`.trim()}>
      <InputGroupAddon.Text aria-hidden="true" variant={inline ? "default" : "container"} className={inline ? "font-sans text-[14px] text-foreground-muted" : undefined}>
        {prefix}
      </InputGroupAddon.Text>
      <InputGroupInput {...props} data-invalid={props["aria-invalid"] === true || props["aria-invalid"] === "true"} className={inputClassName} />
    </InputGroup>
  );
}

export default function SlugInput(props: SlugInputProps) {
  return <PrefixedInput prefix="/" {...props} />;
}
