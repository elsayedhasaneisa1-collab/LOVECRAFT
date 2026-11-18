import React from "react";
import {
  DEVELOPER_COPYRIGHT_YEAR,
  DEVELOPER_CREDIT_TEXT,
  getDeveloperWhatsAppHref,
} from "@/lib/developer-footer";

interface DeveloperFooterProps {
  mode?: "dark" | "light";
  accentColor?: string;
  surfaceColor?: string;
}

/**
 * Shared Global Mandatory Developer Footer
 * Rendered automatically by the LOVECRAFT website engine on every generated website.
 * Strictly non-removable, theme-adaptive, responsive, and free of horizontal overflow.
 */
export function DeveloperFooter({
  mode = "dark",
  accentColor,
}: DeveloperFooterProps) {
  const isLight = mode === "light";
  const whatsappHref = getDeveloperWhatsAppHref();

  return (
    <footer
      data-lovecraft-global-footer="enforced"
      dir="ltr"
      className={`relative z-20 w-full max-w-full overflow-x-clip border-t px-4 py-5 text-center transition-colors ${
        isLight
          ? "border-stone-900/10 bg-white/80 text-stone-600 backdrop-blur-md"
          : "border-white/10 bg-black/45 text-zinc-400 backdrop-blur-md"
      }`}
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs tracking-wide sm:text-[13px]">
        <span className={isLight ? "text-stone-500" : "text-zinc-500"}>
          © {DEVELOPER_COPYRIGHT_YEAR}
        </span>
        <span aria-hidden="true" className={isLight ? "text-stone-300" : "text-zinc-700"}>
          |
        </span>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="developed by elsayed hasan — WhatsApp"
          style={accentColor ? ({ "--footer-accent": accentColor } as React.CSSProperties) : undefined}
          className={`inline-flex items-center font-medium underline-offset-4 transition-all duration-200 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
            isLight
              ? "text-stone-800 hover:text-stone-950 focus-visible:ring-stone-500"
              : "text-zinc-200 hover:text-white focus-visible:ring-white/60"
          }`}
        >
          {DEVELOPER_CREDIT_TEXT}
        </a>
      </div>
    </footer>
  );
}
