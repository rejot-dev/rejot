import React from "react";

export default function Link(
  {
    href,
    className,
    children,
  }: {
    href: string;
    className?: string;
    children?: React.ReactNode;
  } = {
    href: "#",
    className: "",
  },
) {
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}
