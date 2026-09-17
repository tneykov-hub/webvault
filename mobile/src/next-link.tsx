import type { AnchorHTMLAttributes, MouseEvent } from "react";
import { isNativeApp } from "@/lib/native-app";

type NativeLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
};

function nativeRoute(href: string) {
  if (href === "/") return "#home";
  if (href === "/pricing") return "#pricing";
  return null;
}

export default function NativeLink({ href, onClick, ...props }: NativeLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented || !isNativeApp()) return;

    const route = nativeRoute(href);
    if (!route) return;

    event.preventDefault();
    window.location.hash = route;
  }

  return <a {...props} href={href} onClick={handleClick} />;
}
