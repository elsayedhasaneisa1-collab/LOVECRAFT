import { and, count, desc, eq, gt, ne } from "drizzle-orm";
import {
  db,
  users,
  userSessions,
  userCredits,
  creditTransactions,
  referrals,
  templateCategories,
  templates,
  sites,
  siteExpirations,
  siteReferralRequirements,
  botSettings,
  systemSettings,
} from "@/db";
import {
  registerOrTouchTelegramUser,
  createUserSite,
  updateUserSite,
  deleteUserSiteNoRefund,
} from "./site-engine";
import {
  THEME_PALETTES,
  MUSIC_TRACKS,
  getComponentsByGroup,
  getPaletteById,
} from "./components-catalog";
import {
  escapeTelegramHtml,
  generateSecureToken,
  sanitizePlainText,
} from "./security";
import { buildReferralQr, buildSiteQr } from "./qr-service";
import { attachablePhoto } from "./site-media";
import { MAX_DRAFT_PHOTOS } from "./upload-limits";
import type { TemplateFieldSchema } from "./templates-catalog";

export interface InlineButton {
  text: string;
  callback_data?: string;
  url?: string;
  switch_inline_query?: string;
}

export interface BotRenderResponse {
  mode: "edit_text" | "edit_media";
  parse_mode: "HTML";
  text: string;
  photo_url?: string | null;
  reply_markup: {
    inline_keyboard: InlineButton[][];
  };
  awaiting_input?: "none" | "text" | "photo_or_skip";
  input_placeholder?: string;
  callback_toast?: string;
}

interface WizardDraft {
  templateSlug?: string;
  templateNameAr?: string;
  categoryId?: number;
  tier?: string;
  creditCost?: number;
  stepIndex?: number;
  fields?: Record<string, string>;
  assetIds?: number[];
  paletteId?: string;
  heroVariant?: string;
  backgroundVariant?: string;
  buttonVariant?: string;
  galleryVariant?: string;
  effects?: string[];
  musicTrack?: string;
  durationMode?: "fixed" | "continuous";
  durationDays?: number;
  confirmIdempotencyKey?: string;
  editingSiteId?: number;
  editingField?: "headline" | "mainMessage" | "finalSurpriseText";
}

function mainMenuKeyboard(): InlineButton[][] {
  return [
    [{ text: "🌐 إنشاء موقع جديد", callback_data: "nav:create" }],
    [
      { text: "🎨 تصفح القوالب", callback_data: "nav:browse" },
      { text: "📁 مواقعي", callback_data: "sites:list:0" },
    ],
    [
      { text: "🎟️ رمز QR لموقعي", callback_data: "nav:qr" },
      { text: "🎁 الإحالات", callback_data: "nav:referrals" },
    ],
    [{ text: "👤 حسابي", callback_data: "nav:account" }],
    [{ text: "❓ المساعدة", callback_data: "nav:help" }],
  ];
}

async function getOrCreateUserSession(userId: number) {
  const [existing] = await db
    .select()
    .from(userSessions)
    .where(and(eq(userSessions.userId, userId), gt(userSessions.expiresAt, new Date())))
    .orderBy(desc(userSessions.updatedAt), desc(userSessions.id)).limit(1);

  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  if (existing) return existing;

  const [created] = await db
    .insert(userSessions)
    .values({
      userId,
      sessionToken: generateSecureToken(20),
      currentScreen: "main_menu",
      draftPayload: {},
      expiresAt: expires,
    })
    .returning();
  return created!;
}

async function saveSessionState(
  sessionId: number,
  screen: string,
  wizardStep: string | null,
  draft: WizardDraft
) {
  await db
    .update(userSessions)
    .set({
      currentScreen: screen,
      wizardStep,
      draftPayload: draft as unknown as Record<string, unknown>,
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })
    .where(eq(userSessions.id, sessionId));
}

function resolveBaseDomain(baseUrlOverride?: string, sysDomain?: string): string {
  const raw = (baseUrlOverride || sysDomain || "https://lovecraft.app").replace(/\/+$/, "");
  return raw;
}

export async function processBotInteraction(params: {
  telegramUserId: number;
  telegramChatId: number;
  username?: string | null;
  firstName: string;
  lastName?: string | null;
  actionType: "start" | "callback" | "text" | "photo_uploaded" | "photo_error";
  photoError?: "size" | "storage" | "file";
  startPayload?: string | null;
  callbackData?: string | null;
  textInput?: string | null;
  uploadedAsset?: { assetId: number; url: string } | null;
  baseUrl?: string;
  ipAddress?: string;
}): Promise<BotRenderResponse> {
  const [botCfg] = await db.select().from(botSettings).limit(1);
  const [sysCfg] = params.baseUrl ? [] : await db.select({primaryDomain: systemSettings.primaryDomain}).from(systemSettings).limit(1);
  const domain = resolveBaseDomain(params.baseUrl, sysCfg?.primaryDomain);
  const botUsername = botCfg?.botUsername || "LoveCraftMakerBot";

  // Strictly block any admin command attempt — bot is for regular end-users ONLY
  if (
    params.actionType === "text" &&
    params.textInput &&
    /^\/(admin|owner|ban|unban|panel|sudo|grant)/i.test(params.textInput.trim())
  ) {
    return {
      mode: "edit_text",
      parse_mode: "HTML",
      text:
        "ℹ️ <b>LOVECRAFT BOT</b> مخصص للمستخدمين لإنشاء وإدارة مواقعهم الشخصية فقط.\n\nاستخدم الأزرار التفاعلية أدناه للتنقل في القوائم.",
      reply_markup: { inline_keyboard: mainMenuKeyboard() },
      awaiting_input: "none",
    };
  }

  const reg = await registerOrTouchTelegramUser({
    telegramUserId: params.telegramUserId,
    telegramChatId: params.telegramChatId,
    username: params.username,
    firstName: params.firstName,
    lastName: params.lastName,
    startPayload: params.actionType === "start" ? params.startPayload : null,
    ipAddress: params.ipAddress,
  });

  // Enforce active ban across ALL bot operations
  if (reg.ban.isBanned) {
    const expiryLine = reg.ban.expiresAt
      ? `\n⏳ <b>ينتهي الحظر في:</b> <code>${reg.ban.expiresAt.toISOString().slice(0, 16).replace("T", " ")} UTC</code>`
      : "\n⛔ <b>نوع الحظر:</b> دائم";
    return {
      mode: "edit_text",
      parse_mode: "HTML",
      text: `🚫 <b>تم تقييد وصول هذا الحساب</b>\n\n<b>السبب:</b> ${escapeTelegramHtml(
        reg.ban.reason || "مخالفة سياسات الاستخدام"
      )}${expiryLine}\n\nلا يمكنك استخدام البوت أو إنشاء المواقع أو تعديلها أثناء سريان الحظر.`,
      reply_markup: {
        inline_keyboard: [[{ text: "🔄 التحقق من حالة الحساب", callback_data: "nav:main" }]],
      },
      awaiting_input: "none",
    };
  }

  const session = await getOrCreateUserSession(reg.user.id);
  const draft = (session.draftPayload || {}) as WizardDraft;

  // Handle /start
  if (params.actionType === "start") {
    await saveSessionState(session.id, "main_menu", null, {});
    const welcome =
      botCfg?.welcomeMessageAr ||
      "<b>أهلاً بك في LOVECRAFT BOT</b> ✨\n<i>Your Moments. Your Website.</i>";
    const refBanner =
      reg.referralOutcome && reg.referralOutcome.message
        ? `\n\n🎁 <i>${escapeTelegramHtml(reg.referralOutcome.message)}</i>`
        : "";
    return {
      mode: "edit_text",
      parse_mode: "HTML",
      text: `${welcome}${refBanner}\n\nمرحباً <b>${escapeTelegramHtml(
        reg.user.firstName
      )}</b>، اختر من القائمة الرئيسية:`,
      reply_markup: { inline_keyboard: mainMenuKeyboard() },
      awaiting_input: "none",
    };
  }

  if (params.actionType === "photo_uploaded" || params.actionType === "photo_error") {
    if (session.wizardStep !== "photos" || !draft.templateSlug) {
      return { mode: "edit_text", parse_mode: "HTML", text: "ابدأ إعداد موقعك ثم أرسل الصورة في خطوة إضافة الصور.",
        reply_markup: { inline_keyboard: mainMenuKeyboard() }, awaiting_input: "none" };
    }
    if (params.actionType === "photo_error") {
      const errors = { size: "الحد الأقصى للصورة 4 ميجابايت.", file: "تعذر قراءة الصورة. أرسل JPG أو PNG أو WebP أو GIF سليمة.", storage: "تعذر رفع الصورة الآن. يمكنك المحاولة مرة أخرى أو المتابعة بدونها." };
      return renderPhotosStep(draft, errors[params.photoError ?? "storage"]);
    }
    const assetId = params.uploadedAsset?.assetId;
    if (!assetId || !await attachablePhoto(reg.user.id, assetId)) return renderPhotosStep(draft, "الصورة غير متاحة لهذه الجلسة.");
    const ids = draft.assetIds ?? [];
    if (ids.includes(assetId)) return renderPhotosStep(draft, "الصورة مضافة بالفعل.");
    if (ids.length >= MAX_DRAFT_PHOTOS) return renderPhotosStep(draft, "وصلت للحد الأقصى للصور.");
    const nextDraft: WizardDraft = { ...draft, assetIds: [...ids, assetId] };
    await saveSessionState(session.id, "wizard", "photos", nextDraft);
    return renderPhotosStep(nextDraft, "✅ تم حفظ رابط الصورة على Vercel Blob.");
  }

  // Handle text input during wizard or site edit
  if (params.actionType === "text") {
    const raw = (params.textInput || "").trim();
    if (raw === "/start") {
      await saveSessionState(session.id, "main_menu", null, {});
      return {
        mode: "edit_text",
        parse_mode: "HTML",
        text: `${botCfg?.welcomeMessageAr || "<b>LOVECRAFT BOT</b>"}\n\nاختر من القائمة الرئيسية:`,
        reply_markup: { inline_keyboard: mainMenuKeyboard() },
        awaiting_input: "none",
      };
    }

    // Editing an existing site field
    if (session.currentScreen === "edit_site" && draft.editingSiteId && draft.editingField) {
      const cleanVal = sanitizePlainText(raw, 1800);
      if (!cleanVal) {
        return {
          mode: "edit_text",
          parse_mode: "HTML",
          text: "⚠️ النص المُدخل فارغ. يرجى إرسال نص واضح أو الضغط على رجوع.",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 رجوع للموقع", callback_data: `sites:view:${draft.editingSiteId}` }],
            ],
          },
          awaiting_input: "text",
        };
      }
      const res = await updateUserSite({
        userId: reg.user.id,
        siteId: draft.editingSiteId,
        [draft.editingField]: cleanVal,
      });
      await saveSessionState(session.id, "sites", null, {});
      return renderSingleSite(reg.user.id, reg.user.referralCode, draft.editingSiteId, domain, botUsername, res.message);
    }

    // Wizard field collection
    if (session.currentScreen === "wizard" && session.wizardStep === "field" && draft.templateSlug) {
      const [tpl] = await db
        .select()
        .from(templates)
        .where(eq(templates.slug, draft.templateSlug))
        .limit(1);

      if (tpl) {
        const schema = (tpl.fieldsSchema || []) as unknown as TemplateFieldSchema[];
        const idx = draft.stepIndex ?? 0;
        const currentField = schema[idx];
        if (currentField) {
          const cleaned = sanitizePlainText(raw, currentField.type === "textarea" ? 1800 : 250);
          if (!cleaned && currentField.required) {
            return renderWizardFieldStep(tpl.nameAr, schema, idx, draft, "⚠️ هذا الحقل مطلوب، يرجى كتابة القيمة.");
          }
          if(currentField.type === 'date' && cleaned && (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned) || !Number.isFinite(Date.parse(cleaned)) || new Date(cleaned).toISOString().slice(0,10)!==cleaned)) return renderWizardFieldStep(tpl.nameAr,schema,idx,draft,'أرسل تاريخًا صالحًا بصيغة YYYY-MM-DD.');
          const updatedFields = { ...(draft.fields || {}), [currentField.key]: cleaned };
          const nextIdx = idx + 1;
          const nextDraft: WizardDraft = { ...draft, fields: updatedFields, stepIndex: nextIdx };

          if (nextIdx < schema.length) {
            await saveSessionState(session.id, "wizard", "field", nextDraft);
            return renderWizardFieldStep(tpl.nameAr, schema, nextIdx, nextDraft);
          } else {
            await saveSessionState(session.id, "wizard", "photos", nextDraft);
            return renderPhotosStep(nextDraft);
          }
        }
      }
    }

    // Default: always guide user back via inline buttons (no ReplyKeyboardMarkup!)
    return {
      mode: "edit_text",
      parse_mode: "HTML",
      text: "✨ <b>القائمة الرئيسية — LOVECRAFT BOT</b>\nاستخدم الأزرار التفاعلية أدناه للتنقل السلس:",
      reply_markup: { inline_keyboard: mainMenuKeyboard() },
      awaiting_input: "none",
    };
  }

  // ================= CALLBACK QUERIES =================
  const cb = params.callbackData || "nav:main";

  if (cb === "nav:main") {
    await saveSessionState(session.id, "main_menu", null, {});
    return {
      mode: "edit_text",
      parse_mode: "HTML",
      text: `${botCfg?.welcomeMessageAr || "<b>LOVECRAFT BOT</b>"}\n\nاختر القسم المطلوب:`,
      reply_markup: { inline_keyboard: mainMenuKeyboard() },
      awaiting_input: "none",
    };
  }

  if (cb === "nav:help") {
    await saveSessionState(session.id, "help", null, {});
    return {
      mode: "edit_text",
      parse_mode: "HTML",
      text:
        botCfg?.helpMessageAr ||
        "<b>❓ المساعدة — LOVECRAFT BOT</b>\nاختر قالباً، خصص بياناتك، واحصل على رابطك المستقل فوراً.",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🌐 إنشاء موقع جديد", callback_data: "nav:create" },
            { text: "🎁 نظام الإحالات", callback_data: "nav:referrals" },
          ],
          [{ text: "🔙 القائمة الرئيسية", callback_data: "nav:main" }],
        ],
      },
      awaiting_input: "none",
    };
  }

  // Categories list (for both Create & Browse)
  if (cb === "nav:create" || cb === "nav:browse") {
    const isCreate = cb === "nav:create";
    const cats = await db
      .select()
      .from(templateCategories)
      .where(eq(templateCategories.isPublished, true))
      .orderBy(templateCategories.sortOrder);

    const rows: InlineButton[][] = [];
    for (let i = 0; i < cats.length; i += 2) {
      const pair: InlineButton[] = [
        {
          text: `${cats[i]!.emoji} ${cats[i]!.nameAr}`,
          callback_data: `cat:${cats[i]!.id}:0`,
        },
      ];
      if (cats[i + 1]) {
        pair.push({
          text: `${cats[i + 1]!.emoji} ${cats[i + 1]!.nameAr}`,
          callback_data: `cat:${cats[i + 1]!.id}:0`,
        });
      }
      rows.push(pair);
    }
    rows.push([{ text: "🔙 القائمة الرئيسية", callback_data: "nav:main" }]);

    await saveSessionState(session.id, "categories", null, {});
    return {
      mode: "edit_text",
      parse_mode: "HTML",
      text: isCreate
        ? "🌐 <b>إنشاء موقع جديد</b>\n\nالخطوة 1: اختر التصنيف المناسب للحظتك لتصفح القوالب الجاهزة:"
        : "🎨 <b>مكتبة قوالب LOVECRAFT BOT</b>\n\nاختر التصنيف لاستعراض القوالب ومعاينتها مباشرة:",
      reply_markup: { inline_keyboard: rows },
      awaiting_input: "none",
    };
  }

  // Paginated templates inside a category: cat:<catId>:<page>
  if (cb.startsWith("cat:")) {
    const [, catIdStr, pageStr] = cb.split(":");
    const catId = Number(catIdStr);
    const page = Math.max(0, Number(pageStr) || 0);
    const pageSize = 6;

    const [cat] = await db
      .select()
      .from(templateCategories)
      .where(eq(templateCategories.id, catId))
      .limit(1);

    if (!cat) {
      return {
        mode: "edit_text",
        parse_mode: "HTML",
        text: "⚠️ التصنيف غير متاح حالياً.",
        reply_markup: { inline_keyboard: mainMenuKeyboard() },
      };
    }

    const [{ value: total }] = await db
      .select({ value: count() })
      .from(templates)
      .where(and(eq(templates.categoryId, catId), eq(templates.isPublished, true)));

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages - 1);

    const list = await db
      .select()
      .from(templates)
      .where(and(eq(templates.categoryId, catId), eq(templates.isPublished, true)))
      .orderBy(templates.sortOrder, templates.id)
      .limit(pageSize)
      .offset(safePage * pageSize);

    const kb: InlineButton[][] = list.map((t) => [
      {
        text: `${t.tier === "premium" ? "💎" : "✨"} ${t.nameAr}`,
        callback_data: `tpl:${t.id}:${safePage}`,
      },
    ]);

    if (totalPages > 1) {
      const navRow: InlineButton[] = [];
      if (safePage > 0) {
        navRow.push({ text: "◀️ السابق", callback_data: `cat:${catId}:${safePage - 1}` });
      }
      navRow.push({
        text: `📄 ${safePage + 1} / ${totalPages}`,
        callback_data: `cat:${catId}:${safePage}`,
      });
      if (safePage < totalPages - 1) {
        navRow.push({ text: "التالي ▶️", callback_data: `cat:${catId}:${safePage + 1}` });
      }
      kb.push(navRow);
    }

    kb.push([
      { text: "🔙 التصنيفات", callback_data: "nav:browse" },
      { text: "🏠 الرئيسية", callback_data: "nav:main" },
    ]);

    return {
      mode: "edit_text",
      parse_mode: "HTML",
      text: `${cat.emoji} <b>${escapeTelegramHtml(cat.nameAr)}</b>\n<i>${escapeTelegramHtml(
        cat.descriptionAr
      )}</i>\n\nإجمالي القوالب المتاحة: <b>${total}</b> قالب\nاضغط على أي قالب لمعاينته وبدء التخصيص:`,
      reply_markup: { inline_keyboard: kb },
      awaiting_input: "none",
    };
  }

  // Template details & preview (edit_media supported): tpl:<tplId>:<returnPage>
  if (cb.startsWith("tpl:")) {
    const [, tplIdStr, retPageStr] = cb.split(":");
    const tplId = Number(tplIdStr);
    const retPage = Math.max(0, Number(retPageStr) || 0);

    const [tpl] = await db
      .select()
      .from(templates)
      .where(and(eq(templates.id, tplId), eq(templates.isPublished, true)))
      .limit(1);

    if (!tpl) {
      return {
        mode: "edit_text",
        parse_mode: "HTML",
        text: "⚠️ هذا القالب غير متاح حالياً.",
        reply_markup: { inline_keyboard: [[{ text: "🔙 التصنيفات", callback_data: "nav:browse" }]] },
      };
    }

    const defCfg = tpl.defaultConfig as {
      componentsConfig?: { hero?: string; background?: string; gallery?: string; effects?: string[] };
    };
    const tierText =
      tpl.tier === "premium" ? `💎 مميز (${tpl.creditCost} رصيد إنشاء)` : "✨ مجاني للمدد المحددة";
    const previewUrl = `${domain}/preview/${tpl.slug}`;
    const photoUrl = tpl.previewImage.startsWith("http")
      ? tpl.previewImage
      : `${domain}${tpl.previewImage}`;

    return {
      mode: "edit_media",
      parse_mode: "HTML",
      photo_url: photoUrl,
      text:
        `🎨 <b>${escapeTelegramHtml(tpl.nameAr)}</b> <code>v${escapeTelegramHtml(tpl.currentVersion)}</code>\n\n` +
        `${escapeTelegramHtml(tpl.descriptionAr)}\n\n` +
        `• <b>الفئة:</b> ${tierText}\n` +
        `• <b>تصميم الواجهة:</b> <code>${escapeTelegramHtml(defCfg.componentsConfig?.hero || "cinematic")}</code>\n` +
        `• <b>الخلفية والمؤثرات:</b> <code>${escapeTelegramHtml(
          defCfg.componentsConfig?.background || "stars"
        )}</code> + <code>${escapeTelegramHtml(
          (defCfg.componentsConfig?.effects || []).join(", ")
        )}</code>`,
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ اختيار هذا القالب والبدء", callback_data: `wiz:start:${tpl.id}` }],
          [{ text: "👁️ معاينة القالب الحية", url: previewUrl }],
          [
            { text: "🔙 رجوع للقوالب", callback_data: `cat:${tpl.categoryId}:${retPage}` },
            { text: "🏠 الرئيسية", callback_data: "nav:main" },
          ],
        ],
      },
      awaiting_input: "none",
    };
  }

  // Start creation wizard: wiz:start:<tplId>
  if (cb.startsWith("wiz:start:")) {
    const tplId = Number(cb.split(":")[2]);
    const [tpl] = await db
      .select()
      .from(templates)
      .where(and(eq(templates.id, tplId), eq(templates.isPublished, true)))
      .limit(1);

    if (!tpl) {
      return {
        mode: "edit_text",
        parse_mode: "HTML",
        text: "⚠️ القالب غير متاح.",
        reply_markup: { inline_keyboard: mainMenuKeyboard() },
      };
    }

    const defCfg = tpl.defaultConfig as {
      paletteId?: string;
      componentsConfig?: {
        hero?: string;
        background?: string;
        button?: string;
        gallery?: string;
        effects?: string[];
      };
      musicTrack?: string;
    };

    const allowedDays = botCfg?.allowedDurationsDays ?? [1, 4, 7, 30];
    const newDraft: WizardDraft = {
      templateSlug: tpl.slug,
      templateNameAr: tpl.nameAr,
      categoryId: tpl.categoryId,
      tier: tpl.tier,
      creditCost: tpl.creditCost,
      stepIndex: 0,
      fields: {},
      assetIds: [],
      paletteId: defCfg.paletteId || "crimson-velvet",
      heroVariant: defCfg.componentsConfig?.hero || "cinematic",
      backgroundVariant: defCfg.componentsConfig?.background || "stars",
      buttonVariant: defCfg.componentsConfig?.button || "gradient",
      galleryVariant: defCfg.componentsConfig?.gallery || "memory-gallery",
      effects: defCfg.componentsConfig?.effects || ["confetti", "scroll-reveal"],
      musicTrack: defCfg.musicTrack || "romantic-piano",
      durationMode: "fixed",
      durationDays: allowedDays[2] ?? allowedDays[0] ?? 7,
      confirmIdempotencyKey: `bot-${reg.user.id}-${generateSecureToken(8)}`,
    };

    const schema = (tpl.fieldsSchema || []) as unknown as TemplateFieldSchema[];
    await saveSessionState(session.id, "wizard", "field", newDraft);
    return renderWizardFieldStep(tpl.nameAr, schema, 0, newDraft);
  }

  // Skip optional wizard field
  if (cb === "wiz:skip_field" && draft.templateSlug) {
    const [tpl] = await db
      .select()
      .from(templates)
      .where(eq(templates.slug, draft.templateSlug))
      .limit(1);
    if (tpl) {
      const schema = (tpl.fieldsSchema || []) as unknown as TemplateFieldSchema[];
      if(schema[draft.stepIndex??0]?.required) return renderWizardFieldStep(tpl.nameAr,schema,draft.stepIndex??0,draft,'هذا الحقل مطلوب قبل المتابعة.');
      const nextIdx = (draft.stepIndex ?? 0) + 1;
      const nextDraft: WizardDraft = { ...draft, stepIndex: nextIdx };
      if (nextIdx < schema.length) {
        await saveSessionState(session.id, "wizard", "field", nextDraft);
        return renderWizardFieldStep(tpl.nameAr, schema, nextIdx, nextDraft);
      } else {
        await saveSessionState(session.id, "wizard", "photos", nextDraft);
        return renderPhotosStep(nextDraft);
      }
    }
  }

  // Previous wizard field
  if (cb === "wiz:prev_field" && draft.templateSlug) {
    const [tpl] = await db
      .select()
      .from(templates)
      .where(eq(templates.slug, draft.templateSlug))
      .limit(1);
    if (tpl) {
      const schema = (tpl.fieldsSchema || []) as unknown as TemplateFieldSchema[];
      const prevIdx = Math.max(0, (draft.stepIndex ?? 1) - 1);
      const nextDraft: WizardDraft = { ...draft, stepIndex: prevIdx };
      await saveSessionState(session.id, "wizard", "field", nextDraft);
      return renderWizardFieldStep(tpl.nameAr, schema, prevIdx, nextDraft);
    }
  }

  // Move to Photos step
  if (cb === "wiz:photos" && draft.templateSlug) {
    await saveSessionState(session.id, "wizard", "photos", draft);
    return renderPhotosStep(draft);
  }

  // Move to Color Palette step
  if (cb === "wiz:colors" || cb.startsWith("wiz:setcolor:")) {
    const nextDraft = { ...draft };
    if (cb.startsWith("wiz:setcolor:")) {
      nextDraft.paletteId = cb.split(":")[2] || nextDraft.paletteId;
    }
    await saveSessionState(session.id, "wizard", "colors", nextDraft);

    const kb: InlineButton[][] = [];
    for (let i = 0; i < THEME_PALETTES.length; i += 2) {
      const p1 = THEME_PALETTES[i]!;
      const p2 = THEME_PALETTES[i + 1];
      const row: InlineButton[] = [
        {
          text: `${nextDraft.paletteId === p1.id ? "✅ " : ""}${p1.emoji} ${p1.nameAr}`,
          callback_data: `wiz:setcolor:${p1.id}`,
        },
      ];
      if (p2) {
        row.push({
          text: `${nextDraft.paletteId === p2.id ? "✅ " : ""}${p2.emoji} ${p2.nameAr}`,
          callback_data: `wiz:setcolor:${p2.id}`,
        });
      }
      kb.push(row);
    }
    kb.push([
      { text: "🔙 الصور", callback_data: "wiz:photos" },
      { text: "التالي: التصميم والمؤثرات ▶️", callback_data: "wiz:design" },
    ]);

    return {
      mode: "edit_text",
      parse_mode: "HTML",
      text: `🎨 <b>تخصيص الألوان والهوية البصرية</b>\n\nاختر لوحة الألوان المتناغمة لموقعك:`,
      reply_markup: { inline_keyboard: kb },
      awaiting_input: "none",
    };
  }

  // Design components & Effects step
  if (
    cb === "wiz:design" ||
    cb.startsWith("wiz:hero:") ||
    cb.startsWith("wiz:bg:") ||
    cb.startsWith("wiz:eff:")
  ) {
    const nextDraft = { ...draft };
    if (cb.startsWith("wiz:hero:")) nextDraft.heroVariant = cb.split(":")[2];
    if (cb.startsWith("wiz:bg:")) nextDraft.backgroundVariant = cb.split(":")[2];
    if (cb.startsWith("wiz:eff:")) {
      const eff = cb.split(":")[2]!;
      const set = new Set(nextDraft.effects || []);
      if (set.has(eff)) set.delete(eff);
      else set.add(eff);
      nextDraft.effects = Array.from(set);
    }
    await saveSessionState(session.id, "wizard", "design", nextDraft);

    const heroes = getComponentsByGroup("hero").slice(0, 6);
    const bgs = getComponentsByGroup("background").slice(0, 6);
    const effs = ["confetti", "fireworks", "floating-hearts", "stars", "3d-objects", "parallax"];
    const effLabels: Record<string, string> = {
      confetti: "🎊 قصاصات",
      fireworks: "🎆 ألعاب نارية",
      "floating-hearts": "💖 قلوب",
      stars: "⭐ نجوم",
      "3d-objects": "🧊 عناصر 3D",
      parallax: "🌊 عمق Parallax",
    };

    const kb: InlineButton[][] = [];
    for (let i = 0; i < heroes.length; i += 3) {
      kb.push(
        heroes.slice(i, i + 3).map((h) => ({
          text: `${nextDraft.heroVariant === h.variantKey ? "✅" : "▫️"} ${h.nameEn}`,
          callback_data: `wiz:hero:${h.variantKey}`,
        }))
      );
    }
    for (let i = 0; i < bgs.length; i += 3) {
      kb.push(
        bgs.slice(i, i + 3).map((b) => ({
          text: `${nextDraft.backgroundVariant === b.variantKey ? "🌟" : "▫️"} ${b.nameEn}`,
          callback_data: `wiz:bg:${b.variantKey}`,
        }))
      );
    }
    for (let i = 0; i < effs.length; i += 2) {
      kb.push(
        effs.slice(i, i + 2).map((e) => ({
          text: `${(nextDraft.effects || []).includes(e) ? "✅" : "➕"} ${effLabels[e] || e}`,
          callback_data: `wiz:eff:${e}`,
        }))
      );
    }
    kb.push([
      { text: "🔙 الألوان", callback_data: "wiz:colors" },
      { text: "التالي: الموسيقى والمدة ▶️", callback_data: "wiz:music" },
    ]);

    return {
      mode: "edit_text",
      parse_mode: "HTML",
      text:
        `✨ <b>إعدادات التصميم الداخلي والمؤثرات 3D</b>\n\n` +
        `• <b>Hero:</b> <code>${escapeTelegramHtml(nextDraft.heroVariant || "cinematic")}</code>\n` +
        `• <b>الخلفية:</b> <code>${escapeTelegramHtml(nextDraft.backgroundVariant || "stars")}</code>\n` +
        `• <b>المؤثرات المفعّلة:</b> <code>${escapeTelegramHtml(
          (nextDraft.effects || []).join(", ") || "smooth-transitions"
        )}</code>\n\nيمكنك تعديل أي عنصر أو المتابعة:`,
      reply_markup: { inline_keyboard: kb },
      awaiting_input: "none",
    };
  }

  // Music & Duration selection step
  if (cb === "wiz:music" || cb.startsWith("wiz:setmusic:") || cb.startsWith("wiz:dur:")) {
    const nextDraft = { ...draft };
    if (cb.startsWith("wiz:setmusic:")) nextDraft.musicTrack = cb.split(":")[2];
    if (cb.startsWith("wiz:dur:")) {
      const val = cb.split(":")[2];
      if (val === "continuous") {
        nextDraft.durationMode = "continuous";
        nextDraft.durationDays = undefined;
      } else {
        nextDraft.durationMode = "fixed";
        nextDraft.durationDays = Number(val) || 7;
      }
    }
    await saveSessionState(session.id, "wizard", "music", nextDraft);

    const kb: InlineButton[][] = [];
    if (botCfg?.musicFeatureEnabled !== false) {
      for (let i = 0; i < MUSIC_TRACKS.length; i += 2) {
        kb.push(
          MUSIC_TRACKS.slice(i, i + 2).map((m) => ({
            text: `${nextDraft.musicTrack === m.id ? "🎵 " : ""}${m.nameAr}`,
            callback_data: `wiz:setmusic:${m.id}`,
          }))
        );
      }
    }

    const allowedDays = botCfg?.allowedDurationsDays ?? [1, 4, 7, 30];
    const dayLabels: Record<number, string> = { 1: "يوم واحد", 4: "4 أيام", 7: "أسبوع", 30: "شهر" };
    kb.push(
      allowedDays.map((d) => ({
        text: `${
          nextDraft.durationMode === "fixed" && nextDraft.durationDays === d ? "✅ " : ""
        }⏳ ${dayLabels[d] || `${d} يوم`}`,
        callback_data: `wiz:dur:${d}`,
      }))
    );

    if (botCfg?.continuousSitesEnabled !== false) {
      kb.push([
        {
          text: `${
            nextDraft.durationMode === "continuous" ? "✅ " : ""
          }♾️ موقع مستمر (${botCfg?.weeklyReferralsForContinuous ?? 2} إحالات أسبوعياً)`,
          callback_data: "wiz:dur:continuous",
        },
      ]);
    }

    kb.push([
      { text: "🔙 التصميم", callback_data: "wiz:design" },
      { text: "📋 مراجعة الملخص والتأكيد ▶️", callback_data: "wiz:summary" },
    ]);

    return {
      mode: "edit_text",
      parse_mode: "HTML",
      text:
        `🎶 <b>الموسيقى الاختيارية ومدة تشغيل الموقع</b>\n\n` +
        `<i>ملاحظة: لا يعمل الصوت تلقائياً إلا بعد تفاعل الزائر مع الموقع.</i>\n\n` +
        `• <b>المواقع محددة المدة:</b> تعمل طوال المدة المختارة دون حاجة لإحالات وتتوقف تلقائياً عند انتهائها.\n` +
        `• <b>المواقع المستمرة:</b> تعمل بلا تاريخ انتهاء ثابت بشرط تحقيق ${
          botCfg?.weeklyReferralsForContinuous ?? 2
        } إحالات أسبوعية معتمدة.`,
      reply_markup: { inline_keyboard: kb },
      awaiting_input: "none",
    };
  }

  // Summary & Confirmation step
  if ((cb === 'wiz:summary' || cb === 'wiz:confirm') && draft.templateSlug) {
    const [selected]=await db.select({schema:templates.fieldsSchema,name:templates.nameAr}).from(templates).where(eq(templates.slug,draft.templateSlug)).limit(1);
    const fields=(selected?.schema||[]) as unknown as TemplateFieldSchema[];
    const missing=fields.findIndex(f=>f.required && !draft.fields?.[f.key]?.trim());
    if(missing>=0){const next={...draft,stepIndex:missing};await saveSessionState(session.id,'wizard','field',next);return renderWizardFieldStep(selected!.name,fields,missing,next,'أكمل الحقول المطلوبة لمراجعة الملخص.');}
  }
  if (cb === "wiz:summary" && draft.templateSlug) {
    await saveSessionState(session.id, "wizard", "summary", draft);
    const pal = getPaletteById(draft.paletteId || "crimson-velvet");
    const music = MUSIC_TRACKS.find((m) => m.id === draft.musicTrack)?.nameAr || "بدون موسيقى";
    const f = draft.fields || {};
    const durDesc =
      draft.durationMode === "continuous"
        ? `♾️ مستمر (يتطلب ${botCfg?.weeklyReferralsForContinuous ?? 2} إحالات أسبوعياً)`
        : `⏳ محددة المدة (${draft.durationDays ?? 7} يوم)`;

    return {
      mode: "edit_text",
      parse_mode: "HTML",
      text:
        `📋 <b>ملخص موقعك قبل الإنشاء النهائي</b>\n\n` +
        `• <b>القالب:</b> ${escapeTelegramHtml(draft.templateNameAr || draft.templateSlug)}\n` +
        `• <b>المُهدى إليه / الاسم:</b> ${escapeTelegramHtml(f.recipientName || "—")}\n` +
        `• <b>المُرسِل / التوقيع:</b> ${escapeTelegramHtml(f.senderName || "—")}\n` +
        `• <b>العنوان:</b> ${escapeTelegramHtml(f.headline || "—")}\n` +
        `• <b>الرسالة:</b> ${escapeTelegramHtml((f.mainMessage || "").slice(0, 140))}${
          (f.mainMessage || "").length > 140 ? "..." : ""
        }\n` +
        `• <b>التاريخ:</b> <code>${escapeTelegramHtml(f.eventDate || "غير محدد")}</code>\n` +
        `• <b>الصور المرفوعة:</b> ${(draft.assetIds || []).length} صورة\n` +
        `• <b>الألوان:</b> ${pal.emoji} ${escapeTelegramHtml(pal.nameAr)}\n` +
        `• <b>التصميم:</b> Hero <code>${escapeTelegramHtml(
          draft.heroVariant || "cinematic"
        )}</code> | خلفية <code>${escapeTelegramHtml(draft.backgroundVariant || "stars")}</code>\n` +
        `• <b>الموسيقى:</b> ${escapeTelegramHtml(music)}\n` +
        `• <b>الصلاحية:</b> ${durDesc}\n\n` +
        `هل تؤكد إنشاء الموقع الآن؟`,
      reply_markup: {
        inline_keyboard: [
          [{ text: "🚀 تأكيد وإنشاء الموقع الآن", callback_data: "wiz:confirm" }],
          [
            { text: "🎨 تعديل الألوان", callback_data: "wiz:colors" },
            { text: "⏳ تعديل المدة", callback_data: "wiz:music" },
          ],
          [{ text: "❌ إلغاء والعودة للرئيسية", callback_data: "nav:main" }],
        ],
      },
      awaiting_input: "none",
    };
  }

  // Execute site creation!
  if (cb === "wiz:confirm" && draft.templateSlug) {
    if(session.wizardStep!=='summary') return {mode:'edit_text',parse_mode:'HTML',text:'راجع بيانات موقعك قبل التأكيد النهائي.',reply_markup:{inline_keyboard:[[{text:'مراجعة الملخص',callback_data:'wiz:summary'}]]}};
    const f = draft.fields || {};
    const customFields: Record<string, unknown> = {};
    if (f.profileLinks) customFields.links = f.profileLinks.split('\n').slice(0,8).flatMap(line=>{const [label,url]=line.split('|').map(x=>x.trim());try{if(!label||new URL(url).protocol!=='https:')return [];return [{label,url,tag:'Link'}];}catch{return [];}});
    if (f.secretCode) customFields.secretCode = f.secretCode;
    if (f.secretHint) customFields.secretHint = f.secretHint;
    if (f.eventLocation) customFields.eventLocation = f.eventLocation;
    if (f.roleTitle) customFields.roleTitle = f.roleTitle;
    if (f.contactHandle) customFields.contactHandle = f.contactHandle;
    if (f.memoryNote) customFields.memoryNote = f.memoryNote;
    if (f.quizQuestion) {
      customFields.quizItems = [
        {
          q: f.quizQuestion,
          options: ["بالتأكيد نعم!", "أجمل ذكرى بيننا", "لا يمكن نسيانها أبداً", "كل الإجابات صحيحة"],
          correct: 3,
        },
      ];
    }
    if (f.customStatement) {
      customFields.statements = [
        { text: f.customStatement, answer: true },
        { text: "هذا الموقع صُمم خصيصاً لك بكل محبة.", answer: true },
      ];
    }
    if (f.wheelItems) {
      const parts = f.wheelItems
        .split(/[،,]/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length >= 2) customFields.wheelSlices = parts.slice(0, 8);
    }

    const result = await createUserSite({
      userId: reg.user.id,
      templateSlug: draft.templateSlug,
      idempotencyKey: draft.confirmIdempotencyKey || `bot-${reg.user.id}-${Date.now()}`,
      durationMode: draft.durationMode || "fixed",
      durationDays: draft.durationDays,
      senderName: f.senderName || reg.user.firstName,
      recipientName: f.recipientName || "عزيزي",
      headline: f.headline || draft.templateNameAr || "موقع خاص",
      mainMessage: f.mainMessage || "لحظة مميزة موثقة عبر LOVECRAFT BOT.",
      finalSurpriseText: f.finalSurpriseText,
      eventDate: f.eventDate,
      paletteId: draft.paletteId,
      heroVariant: draft.heroVariant,
      backgroundVariant: draft.backgroundVariant,
      buttonVariant: draft.buttonVariant,
      galleryVariant: draft.galleryVariant,
      effects: draft.effects,
      musicTrack: draft.musicTrack,
      assetIds: draft.assetIds,
      customFields,
    });

    if (!result.ok) {
      return {
        mode: "edit_text",
        parse_mode: "HTML",
        text: `⚠️ <b>تعذّر إتمام الإنشاء</b>\n\n${escapeTelegramHtml(result.message)}`,
        reply_markup: {
          inline_keyboard: [
            [{ text: "🎁 كسب رصيد عبر الإحالات", callback_data: "nav:referrals" }],
            [{ text: "🔙 العودة للملخص", callback_data: "wiz:summary" }],
            [{ text: "🏠 القائمة الرئيسية", callback_data: "nav:main" }],
          ],
        },
        awaiting_input: "none",
      };
    }

    await saveSessionState(session.id, "main_menu", null, {});
    const siteUrl = `${domain}/s/${result.site.slug}`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(
      siteUrl
    )}&text=${encodeURIComponent(`✨ أعددت لك موقعاً خاصاً: ${result.site.title}`)}`;

    return {
      mode: "edit_text",
      parse_mode: "HTML",
      text:
        `🎉 <b>تم إنشاء موقعك المستقل بنجاح!</b>\n\n` +
        `🏷️ <b>العنوان:</b> ${escapeTelegramHtml(result.site.title)}\n` +
        `🔗 <b>الرابط المباشر:</b>\n<code>${escapeTelegramHtml(siteUrl)}</code>\n` +
        `📌 <b>إصدار القالب المثبت:</b> <code>v${escapeTelegramHtml(result.site.pinnedVersion)}</code>\n` +
        (result.site.creditCharged > 0
          ? `💳 <b>الرصيد المخصوم:</b> ${result.site.creditCharged} رصيد\n`
          : "") +
        `\nيمكنك الآن فتح الموقع أو تعديله أو مشاركته مع من تحب:`,
      reply_markup: {
        inline_keyboard: [
          [{ text: "🌐 فتح الموقع الآن", url: siteUrl }, { text: "🎟️ بطاقة QR", callback_data: `qr:site:${result.site.id}` }],
          [
            { text: "✏️ تعديل الموقع", callback_data: `sites:view:${result.site.id}` },
            { text: "📤 مشاركة الرابط", url: shareUrl },
          ],
          [
            { text: "📁 مواقعي", callback_data: "sites:list:0" },
            { text: "🏠 الرئيسية", callback_data: "nav:main" },
          ],
        ],
      },
      awaiting_input: "none",
    };
  }

  // ================= MY SITES =================
  if (cb.startsWith("sites:list:")) {
    const page = Math.max(0, Number(cb.split(":")[2]) || 0);
    const pageSize = 5;

    const [{ value: total }] = await db
      .select({ value: count() })
      .from(sites)
      .where(and(eq(sites.userId, reg.user.id), ne(sites.status, "deleted")));

    if (total === 0) {
      return {
        mode: "edit_text",
        parse_mode: "HTML",
        text: "📁 <b>مواقعي</b>\n\nلم تقم بإنشاء أي موقع بعد. ابدأ الآن بصناعة أول موقع لك خلال دقائق!",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🌐 إنشاء موقع جديد", callback_data: "nav:create" }],
            [{ text: "🔙 القائمة الرئيسية", callback_data: "nav:main" }],
          ],
        },
        awaiting_input: "none",
      };
    }

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages - 1);
    const rows = await db
      .select()
      .from(sites)
      .where(and(eq(sites.userId, reg.user.id), ne(sites.status, "deleted")))
      .orderBy(desc(sites.createdAt))
      .limit(pageSize)
      .offset(safePage * pageSize);

    const statusIcon: Record<string, string> = {
      active: "🟢",
      expired: "⌛",
      paused_referrals: "⏸️",
      paused_admin: "⛔",
      hidden: "🙈",
    };

    const kb: InlineButton[][] = rows.map((s) => [
      {
        text: `${s.isHidden ? "🙈" : statusIcon[s.status] || "🌐"} ${s.title.slice(0, 32)}`,
        callback_data: `sites:view:${s.id}`,
      },
    ]);

    if (totalPages > 1) {
      const nav: InlineButton[] = [];
      if (safePage > 0) nav.push({ text: "◀️ السابق", callback_data: `sites:list:${safePage - 1}` });
      nav.push({ text: `${safePage + 1}/${totalPages}`, callback_data: `sites:list:${safePage}` });
      if (safePage < totalPages - 1)
        nav.push({ text: "التالي ▶️", callback_data: `sites:list:${safePage + 1}` });
      kb.push(nav);
    }

    kb.push([
      { text: "🌐 إنشاء موقع جديد", callback_data: "nav:create" },
      { text: "🔙 الرئيسية", callback_data: "nav:main" },
    ]);

    return {
      mode: "edit_text",
      parse_mode: "HTML",
      text: `📁 <b>مواقعي المستقلة (${total})</b>\n\nاختر موقعاً لعرض رابطه أو تعديله أو إدارته:`,
      reply_markup: { inline_keyboard: kb },
      awaiting_input: "none",
    };
  }

  if (cb.startsWith("sites:view:")) {
    const siteId = Number(cb.split(":")[2]);
    return renderSingleSite(reg.user.id, reg.user.referralCode, siteId, domain, botUsername);
  }

  if (cb.startsWith("sites:edit:")) {
    const [, , siteIdStr, field] = cb.split(":");
    const siteId = Number(siteIdStr);
    const validField =
      field === "headline" || field === "mainMessage" || field === "finalSurpriseText"
        ? field
        : "headline";
    await saveSessionState(session.id, "edit_site", validField, {
      editingSiteId: siteId,
      editingField: validField,
    });
    const labels: Record<string, string> = {
      headline: "العنوان الرئيسي الجديد",
      mainMessage: "نص الرسالة الأساسية الجديدة",
      finalSurpriseText: "نص المفاجأة الختامية الجديدة",
    };
    return {
      mode: "edit_text",
      parse_mode: "HTML",
      text: `✏️ <b>تعديل الموقع</b>\n\nأرسل الآن <b>${labels[validField]}</b>:`,
      reply_markup: {
        inline_keyboard: [[{ text: "🔙 إلغاء والرجوع", callback_data: `sites:view:${siteId}` }]],
      },
      awaiting_input: "text",
      input_placeholder: `اكتب ${labels[validField]}...`,
    };
  }

  if (cb.startsWith("sites:togglehide:")) {
    const siteId = Number(cb.split(":")[2]);
    const [s] = await db
      .select()
      .from(sites)
      .where(and(eq(sites.id, siteId), eq(sites.userId, reg.user.id)))
      .limit(1);
    if (s) {
      await updateUserSite({ userId: reg.user.id, siteId, isHidden: !s.isHidden });
    }
    return renderSingleSite(reg.user.id, reg.user.referralCode, siteId, domain, botUsername);
  }

  if (cb.startsWith("sites:askdel:")) {
    const siteId = Number(cb.split(":")[2]);
    return {
      mode: "edit_text",
      parse_mode: "HTML",
      text:
        `⚠️ <b>تأكيد حذف الموقع نهائياً</b>\n\n` +
        `سيتم إيقاف رابط الموقع بشكل دائم.\n` +
        `<b>تنبيه مهم:</b> حذف الموقع أو إخفاؤه <u>لا يعيد رصيد الإنشاء</u> إلى حسابك.`,
      reply_markup: {
        inline_keyboard: [
          [{ text: "🗑️ نعم، احذف الموقع نهائياً", callback_data: `sites:del:${siteId}` }],
          [{ text: "🔙 تراجع", callback_data: `sites:view:${siteId}` }],
        ],
      },
      awaiting_input: "none",
    };
  }

  if (cb.startsWith("sites:del:")) {
    const siteId = Number(cb.split(":")[2]);
    const delRes = await deleteUserSiteNoRefund({ userId: reg.user.id, siteId });
    return {
      mode: "edit_text",
      parse_mode: "HTML",
      text: `🗑️ <b>إدارة المواقع</b>\n\n${escapeTelegramHtml(delRes.message)}`,
      reply_markup: {
        inline_keyboard: [
          [{ text: "📁 العودة لمواقعي", callback_data: "sites:list:0" }],
          [{ text: "🏠 القائمة الرئيسية", callback_data: "nav:main" }],
        ],
      },
      awaiting_input: "none",
    };
  }

  // ================= QR CARDS =================
  if (cb === "nav:qr") {
    const owned = await db
      .select({
        id: sites.id,
        slug: sites.slug,
        title: sites.title,
        status: sites.status,
        categorySlug: templateCategories.slug,
      })
      .from(sites)
      .innerJoin(templates, eq(sites.templateId, templates.id))
      .innerJoin(templateCategories, eq(templates.categoryId, templateCategories.id))
      .where(and(eq(sites.userId, reg.user.id), ne(sites.status, "deleted")))
      .orderBy(desc(sites.createdAt))
      .limit(10);

    if (owned.length === 0) {
      return {
        mode: "edit_text",
        parse_mode: "HTML",
        text: "🎟️ <b>رموز QR</b>\n\nلا توجد مواقع بعد. أنشئ موقعك أولًا ثم اطلب بطاقته الجاهزة للمشاركة.",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🌐 إنشاء موقع جديد", callback_data: "nav:create" }],
            [{ text: "🔙 القائمة الرئيسية", callback_data: "nav:main" }],
          ],
        },
        awaiting_input: "none",
      };
    }

    const rows: InlineButton[][] = owned.map((site) => [
      {
        text: `🎟️ ${site.title.slice(0, 34)}`,
        callback_data: `qr:site:${site.id}`,
      },
    ]);
    rows.push([
      { text: "🔗 رمز QR لرابط إحالتي", callback_data: "qr:referral" },
    ]);
    rows.push([{ text: "🔙 القائمة الرئيسية", callback_data: "nav:main" }]);

    return {
      mode: "edit_text",
      parse_mode: "HTML",
      text:
        "🎟️ <b>بطاقات QR لموقعك</b>\n\n" +
        "اختر الموقع ليُصنع له رمز QR احترافي بشكل يناسب تصنيفه (قلب للحب، هدية للمناسبات، حلقتان للأصدقاء، ذراع تحكم للألعاب، لوحة ألوان للتصميم، ظرف للرسائل) مع اسم البوت والعلامة المائية.\n\n" +
        "امسح الرمز بكاميرا الهاتف ليُفتح الموقع مباشرة.",
      reply_markup: { inline_keyboard: rows },
      awaiting_input: "none",
    };
  }

  if (cb.startsWith("qr:site:")) {
    const inputId = Number(cb.split(":")[2]);
    const siteId = Number.isInteger(inputId) && inputId > 0 && inputId <= 2147483647 ? inputId : 0;
    const [site] = await db
      .select({
        id: sites.id,
        slug: sites.slug,
        title: sites.title,
        categorySlug: templateCategories.slug,
      })
      .from(sites)
      .innerJoin(templates, eq(sites.templateId, templates.id))
      .innerJoin(templateCategories, eq(templates.categoryId, templateCategories.id))
      .where(and(eq(sites.id, siteId), eq(sites.userId, reg.user.id), ne(sites.status, "deleted")))
      .limit(1);

    if (!site) {
      return {
        mode: "edit_text",
        parse_mode: "HTML",
        text: "⚠️ الموقع غير موجود.",
        reply_markup: { inline_keyboard: [[{ text: "🔙 رجوع", callback_data: "nav:qr" }]] },
        awaiting_input: "none",
      };
    }

    const handle = botUsername.replace(/^@/, "");
    const siteUrl = `${domain}/s/${site.slug}`;
    const qr = buildSiteQr({ siteUrl, botHandle: handle, origin: domain, categorySlug: site.categorySlug });

    if (!qr.ok || !qr.imageUrl) {
      return {
        mode: "edit_text",
        parse_mode: "HTML",
        text: `⚠️ <b>تعذّر إنشاء بطاقة QR</b>\n\n${escapeTelegramHtml(qr.message || "خطأ غير متوقع.")}`,
        reply_markup: { inline_keyboard: [[{ text: "🔙 رجوع", callback_data: "nav:qr" }]] },
        awaiting_input: "none",
      };
    }

    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(siteUrl)}&text=${encodeURIComponent(
      `✨ افتح موقعي: ${site.title}`
    )}`;

    return {
      mode: "edit_media",
      parse_mode: "HTML",
      photo_url: qr.imageUrl,
      text:
        `🎟️ <b>بطاقة QR جاهزة</b>\n\n` +
        `🏷️ الموقع: ${escapeTelegramHtml(site.title)}\n` +
        `🔗 الرابط: <code>${escapeTelegramHtml(siteUrl)}</code>\n` +
        `🎨 الشكل: ${escapeTelegramHtml(qr.shapeLabelAr)}\n` +
        `🏷️ صُنعت بواسطة: <b>@${escapeTelegramHtml(handle)}</b>\n` +
        `📱 امسح الرمز بكاميرا الهاتف، أو شارك الرابط مباشرة.`,
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🌐 فتح الموقع", url: siteUrl },
            { text: "📤 مشاركة الرابط", url: shareUrl },
          ],
          [{ text: "🎟️ بطاقة لموقع آخر", callback_data: "nav:qr" }],
        ],
      },
      awaiting_input: "none",
    };
  }

  if (cb === "qr:referral") {
    const handle = botUsername.replace(/^@/, "");
    const referralUrl = `https://t.me/${handle}?start=${reg.user.referralCode}`;
    const qr = buildReferralQr({
      referralUrl,
      botHandle: `@${handle}`,
      origin: domain,
    });

    if (!qr.ok || !qr.imageUrl) {
      return {
        mode: "edit_text",
        parse_mode: "HTML",
        text: `⚠️ <b>تعذّر إنشاء بطاقة الإحالة</b>\n\n${escapeTelegramHtml(qr.message || "خطأ غير متوقع.")}`,
        reply_markup: { inline_keyboard: [[{ text: "🔙 رجوع", callback_data: "nav:qr" }]] },
        awaiting_input: "none",
      };
    }

    return {
      mode: "edit_media",
      parse_mode: "HTML",
      photo_url: qr.imageUrl,
      text:
        `🔗 <b>بطاقة الإحالة</b>\n\n` +
        `📎 رابطك: <code>${escapeTelegramHtml(referralUrl)}</code>\n` +
        `🏷️ صُنعت بواسطة: <b>@${escapeTelegramHtml(handle)}</b>\n` +
        `📱 امسح الرمز ليستقبل أصدقاؤك رابطك مباشرة، وكل تسجيل جديد يضيف رصيد إنشاء بعد الاعتماد.`,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "📤 مشاركة الرابط",
              url: `https://t.me/share/url?url=${encodeURIComponent(
                referralUrl
              )}&text=${encodeURIComponent("✨ اصنع موقعك التفاعلي مع LOVECRAFT BOT")}`,
            },
          ],
          [{ text: "🎟️ بطاقات مواقعي", callback_data: "nav:qr" }],
        ],
      },
      awaiting_input: "none",
    };
  }

  // ================= REFERRALS =================
  if (cb === "nav:referrals" && reg.user.telegramUserId<0) return {mode:'edit_text',parse_mode:'HTML',text:'<b>الإحالات على تيليجرام</b>\nتُحتسب الإحالات لحسابات Telegram فقط. افتح البوت للحصول على رابطك الشخصي؛ حساب الاستوديو على الويب مستقل عن حساب تيليجرام.',reply_markup:{inline_keyboard:[[{text:'فتح بوت تيليجرام',url:`https://t.me/${botUsername}`}],[{text:'القائمة الرئيسية',callback_data:'nav:main'}]]}};
  if (cb === "nav:referrals") {
    const userRefs = await db
      .select()
      .from(referrals)
      .where(eq(referrals.referrerUserId, reg.user.id));

    const approvedCredit = userRefs.filter(
      (r) => r.status === "approved" && r.purpose === "creation_credit"
    ).length;
    const approvedWeekly = userRefs.filter(
      (r) => r.status === "approved" && r.purpose === "weekly_renewal"
    ).length;
    const pendingCount = userRefs.filter(
      (r) => r.status === "pending" || r.status === "suspicious"
    ).length;
    const rejectedCount = userRefs.filter((r) => r.status === "rejected").length;

    const refLink = `https://t.me/${botUsername}?start=${reg.user.referralCode}`;
    const shareRefUrl = `https://t.me/share/url?url=${encodeURIComponent(
      refLink
    )}&text=${encodeURIComponent("✨ جرب LOVECRAFT BOT واصنع موقعاً تفاعلياً فاخراً للحظاتك!")}`;

    const needed = botCfg?.referralsPerCredit ?? 2;
    const reward = botCfg?.creditsPerReward ?? 1;

    return {
      mode: "edit_text",
      parse_mode: "HTML",
      text:
        `🎁 <b>نظام الإحالات ومكافآت الإنشاء</b>\n\n` +
        `🔗 <b>رابط الإحالة الفريد الخاص بك:</b>\n<code>${escapeTelegramHtml(refLink)}</code>\n\n` +
        `📊 <b>إحصائيات إحالاتك:</b>\n` +
        `• ✅ إحالات رصيد معتمدة: <b>${approvedCredit}</b>\n` +
        `• ♾️ إحالات استمرار المواقع الأسبوعية: <b>${approvedWeekly}</b>\n` +
        `• ⏳ قيد المراجعة: <b>${pendingCount}</b>\n` +
        `• ❌ مرفوضة: <b>${rejectedCount}</b>\n\n` +
        `💳 <b>رصيد الإنشاء الحالي:</b> <b>${reg.credits.balance}</b> رصيد (التقدم الحالي: ${reg.credits.qualifiedReferralsProgress}/${needed})\n` +
        `📌 كل <b>${needed}</b> إحالات معتمدة تمنحك <b>+${reward}</b> رصيد إنشاء.\n` +
        `<i>ملاحظة: إحالات رصيد الإنشاء منفصلة تماماً عن إحالات تجديد المواقع المستمرة الأسبوعية.</i>`,
      reply_markup: {
        inline_keyboard: [
          [{ text: "📤 مشاركة رابط الإحالة", url: shareRefUrl }],
          [
            { text: "👤 سجل الرصيد وحسابي", callback_data: "nav:account" },
            { text: "🔙 الرئيسية", callback_data: "nav:main" },
          ],
        ],
      },
      awaiting_input: "none",
    };
  }

  // ================= ACCOUNT =================
  if (cb === "nav:account") {
    const [{ value: activeSitesCount }] = await db
      .select({ value: count() })
      .from(sites)
      .where(and(eq(sites.userId, reg.user.id), ne(sites.status, "deleted")));

    const recentTx = await db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.userId, reg.user.id))
      .orderBy(desc(creditTransactions.createdAt))
      .limit(4);

    const txLines =
      recentTx.length > 0
        ? recentTx
            .map(
              (t) =>
                `• <code>${t.amount >= 0 ? `+${t.amount}` : t.amount}</code> | ${escapeTelegramHtml(
                  t.description.slice(0, 55)
                )}`
            )
            .join("\n")
        : "• لا توجد معاملات رصيد بعد.";

    return {
      mode: "edit_text",
      parse_mode: "HTML",
      text:
        `👤 <b>حسابي — LOVECRAFT BOT</b>\n\n` +
        `• <b>الاسم:</b> ${escapeTelegramHtml(reg.user.firstName)} ${escapeTelegramHtml(
          reg.user.lastName || ""
        )}\n` +
        `• <b>المعرّف:</b> <code>${reg.user.telegramUserId}</code>${
          reg.user.username ? ` (@${escapeTelegramHtml(reg.user.username)})` : ""
        }\n` +
        `• <b>حالة الحساب:</b> 🟢 نشط\n` +
        `• <b>المواقع الحالية:</b> <b>${activeSitesCount}</b>\n` +
        `• <b>رصيد الإنشاء المتاح:</b> <b>${reg.credits.balance}</b> رصيد\n` +
        `• <b>إجمالي المكتسب / المستخدم:</b> +${reg.credits.lifetimeEarned} / -${reg.credits.lifetimeSpent}\n` +
        `• <b>كود الإحالة:</b> <code>${escapeTelegramHtml(reg.user.referralCode)}</code>\n\n` +
        `🧾 <b>آخر حركات سجل الرصيد:</b>\n${txLines}`,
      reply_markup: {
        inline_keyboard: [
          [
            { text: "📁 مواقعي", callback_data: "sites:list:0" },
            { text: "🎁 الإحالات", callback_data: "nav:referrals" },
          ],
          [{ text: "🔙 القائمة الرئيسية", callback_data: "nav:main" }],
        ],
      },
      awaiting_input: "none",
    };
  }

  return {
    mode: "edit_text",
    parse_mode: "HTML",
    text: "✨ <b>LOVECRAFT BOT</b> — اختر من القائمة:",
    reply_markup: { inline_keyboard: mainMenuKeyboard() },
    awaiting_input: "none",
  };
}

function renderWizardFieldStep(
  templateNameAr: string,
  schema: TemplateFieldSchema[],
  idx: number,
  draft: WizardDraft,
  errorNotice?: string
): BotRenderResponse {
  const field = schema[idx]!;
  const kb: InlineButton[][] = [];
  if (!field.required) {
    kb.push([{ text: "⏭️ تخطي هذه الخطوة", callback_data: "wiz:skip_field" }]);
  }
  const navRow: InlineButton[] = [];
  if (idx > 0) {
    navRow.push({ text: "🔙 السؤال السابق", callback_data: "wiz:prev_field" });
  }
  navRow.push({ text: "❌ إلغاء", callback_data: "nav:main" });
  kb.push(navRow);

  const existing = draft.fields?.[field.key];

  return {
    mode: "edit_text",
    parse_mode: "HTML",
    text:
      `🛠️ <b>تخصيص قالب: ${escapeTelegramHtml(templateNameAr)}</b>\n` +
      `<i>الخطوة ${idx + 1} من ${schema.length}</i>\n\n` +
      (errorNotice ? `${escapeTelegramHtml(errorNotice)}\n\n` : "") +
      `${escapeTelegramHtml(field.promptAr)}` +
      (existing ? `\n\n📌 <i>القيمة الحالية:</i> ${escapeTelegramHtml(existing)}` : ""),
    reply_markup: { inline_keyboard: kb },
    awaiting_input: "text",
    input_placeholder: field.placeholderAr,
  };
}

function renderPhotosStep(draft: WizardDraft, notice?: string): BotRenderResponse {
  const countUploaded = (draft.assetIds || []).length;
  return {
    mode: "edit_text",
    parse_mode: "HTML",
    text:
      `🖼️ <b>إضافة الصور</b>\n\n` +
      (notice ? `${escapeTelegramHtml(notice)}\n\n` : "") +
      `الصور المرفوعة حالياً: <b>${countUploaded}</b> / ${MAX_DRAFT_PHOTOS}\n` +
      `أرسل صورة الآن (JPG / PNG / WebP / GIF) بحجم لا يتجاوز 4 ميجابايت لرفعها إلى Vercel Blob وربطها بموقعك، أو اضغط المتابعة لاستخدام التصميم الجاهز.\n\n` +
      `<i>تنبيه: الصور المرفوعة قابلة للعرض لأي شخص لديه رابطها. لا ترفع صورة خاصة.</i>`,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text:
              countUploaded > 0
                ? `✅ متابعة بـ (${countUploaded}) صور ▶️`
                : "⏭️ تخطي الصور والمتابعة للألوان ▶️",
            callback_data: "wiz:colors",
          },
        ],
        [
          { text: "🔙 السؤال السابق", callback_data: "wiz:prev_field" },
          { text: "❌ إلغاء", callback_data: "nav:main" },
        ],
      ],
    },
    awaiting_input: "photo_or_skip",
  };
}

async function renderSingleSite(
  userId: number,
  referralCode: string,
  siteId: number,
  domain: string,
  botUsername: string,
  flash?: string
): Promise<BotRenderResponse> {
  const [site] = await db
    .select()
    .from(sites)
    .where(and(eq(sites.id, siteId), eq(sites.userId, userId), ne(sites.status, "deleted")))
    .limit(1);

  if (!site) {
    return {
      mode: "edit_text",
      parse_mode: "HTML",
      text: "⚠️ الموقع غير موجود.",
      reply_markup: { inline_keyboard: [[{ text: "📁 مواقعي", callback_data: "sites:list:0" }]] },
    };
  }

  let validityLine = "";
  if (site.durationMode === "fixed") {
    const [exp] = await db
      .select()
      .from(siteExpirations)
      .where(eq(siteExpirations.siteId, site.id))
      .limit(1);
    validityLine = exp
      ? `⏳ ينتهي في: <code>${exp.expiresAt.toISOString().slice(0, 16).replace("T", " ")} UTC</code>`
      : `⏳ مدة محددة (${site.durationDays} يوم)`;
  } else {
    const [reqRow] = await db
      .select()
      .from(siteReferralRequirements)
      .where(eq(siteReferralRequirements.siteId, site.id))
      .limit(1);
    const wkLink = `https://t.me/${botUsername}?start=WK_${site.id}_${referralCode}`;
    validityLine = reqRow
      ? `♾️ مستمر — الإحالات الأسبوعية: <b>${reqRow.completedInWindow}/${reqRow.requiredWeeklyCount}</b>\n🔗 رابط تجديد هذا الموقع:\n<code>${escapeTelegramHtml(
          wkLink
        )}</code>`
      : "♾️ موقع مستمر";
  }

  const statusLabels: Record<string, string> = {
    active: "🟢 يعمل",
    expired: "⌛ انتهت المدة",
    paused_referrals: "⏸️ متوقف مؤقتاً (بانتظار الإحالات الأسبوعية)",
    paused_admin: "⛔ متوقف إدارياً",
    hidden: "🙈 مخفي",
  };

  const url = `${domain}/s/${site.slug}`;
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(
    site.title
  )}`;

  return {
    mode: "edit_text",
    parse_mode: "HTML",
    text:
      (flash ? `✅ <i>${escapeTelegramHtml(flash)}</i>\n\n` : "") +
      `🌐 <b>${escapeTelegramHtml(site.title)}</b>\n\n` +
      `• <b>الرابط:</b> <code>${escapeTelegramHtml(url)}</code>\n` +
      `• <b>الحالة:</b> ${site.isHidden ? "🙈 مخفي" : statusLabels[site.status] || site.status}\n` +
      `• <b>الزيارات:</b> ${site.viewsCount}\n` +
      `• <b>الإصدار المثبت:</b> <code>v${escapeTelegramHtml(site.pinnedVersion)}</code>\n` +
      `• ${validityLine}`,
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🌐 فتح الموقع", url },
          { text: "📤 مشاركة", url: shareUrl },
        ],
        [
          { text: "✏️ تعديل العنوان", callback_data: `sites:edit:${site.id}:headline` },
          { text: "💌 تعديل الرسالة", callback_data: `sites:edit:${site.id}:mainMessage` },
        ],
        [
          { text: "🎟️ رمز QR للموقع", callback_data: `qr:site:${site.id}` },
        ],
        [
          { text: "🎁 تعديل الخاتمة", callback_data: `sites:edit:${site.id}:finalSurpriseText` },
          {
            text: site.isHidden ? "👁️ إظهار الموقع" : "🙈 إخفاء الموقع",
            callback_data: `sites:togglehide:${site.id}`,
          },
        ],
        [
          { text: "🗑️ حذف الموقع", callback_data: `sites:askdel:${site.id}` },
          { text: "🔙 مواقعي", callback_data: "sites:list:0" },
        ],
      ],
    },
    awaiting_input: "none",
  };
}
