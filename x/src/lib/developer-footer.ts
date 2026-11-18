/**
 * IMMUTABLE GLOBAL DEVELOPER FOOTER SPECIFICATION
 * Required on EVERY site rendered by LOVECRAFT BOT.
 * Cannot be removed, hidden, modified, or overridden by user data or templates.
 * Note: Raw phone number is NEVER rendered as visible text; only used in WhatsApp Click-to-Chat URL.
 */

export const DEVELOPER_CREDIT_TEXT = "developed by elsayed hasan" as const;
export const DEVELOPER_COPYRIGHT_YEAR = 2026 as const;

export const DEVELOPER_WHATSAPP_MESSAGE =
  "مرحباً، وصلت إليك من أحد المواقع المنشأة بواسطة LOVECRAFT BOT، وأرغب في التواصل معك بخصوص تصميم أو تطوير موقع ويب." as const;

export const DEVELOPER_WHATSAPP_BASE = "https://wa.me/201550802408" as const;

export const DEVELOPER_WHATSAPP_URL = Object.freeze({
  href: `${DEVELOPER_WHATSAPP_BASE}?text=${encodeURIComponent(DEVELOPER_WHATSAPP_MESSAGE)}`,
  text: DEVELOPER_CREDIT_TEXT,
  year: DEVELOPER_COPYRIGHT_YEAR,
  message: DEVELOPER_WHATSAPP_MESSAGE,
});

export function getDeveloperWhatsAppHref(): string {
  return DEVELOPER_WHATSAPP_URL.href;
}
