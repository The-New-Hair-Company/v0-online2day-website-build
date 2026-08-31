"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const nav = [
  ["Work", "/#work"],
  ["Pricing", "/pricing"],
  ["Marketing", "/marketing"],
  ["About", "/about"],
  ["Contact", "/contact"],
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="brand" href="/" aria-label="online2day.com home" onClick={() => setOpen(false)}>
          <img className="brand-mark" src="/mark.svg" alt="" width="34" height="34" aria-hidden="true" />
          <span>online<span>2</span>day.com</span>
        </Link>

        <button
          className="menu-toggle"
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span /><span />
        </button>

        <nav className={open ? "main-nav open" : "main-nav"} aria-label="Primary navigation">
          {nav.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className={pathname === href ? "active" : undefined}
              onClick={() => setOpen(false)}
            >
              {label}
            </Link>
          ))}
          <Link className="button button-small button-outline" href="/auth/login" onClick={() => setOpen(false)}>
            Login
          </Link>
          <Link className="button button-small button-lime" href="/start" onClick={() => setOpen(false)}>
            Start a project <span aria-hidden="true">↗</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
