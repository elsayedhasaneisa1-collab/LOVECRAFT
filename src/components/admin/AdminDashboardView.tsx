"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Ban,
  Bell,
  Bot,
  Check,
  CheckCircle2,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  FolderGit2,
  Globe,
  History,
  LayoutDashboard,
  Layers,
  LogOut,
  Menu,
  Moon,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Share2,
  ShieldAlert,
  Sun,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";

type AdminTab =
  | "overview"
  | "users"
  | "sites"
  | "referrals"
  | "templates"
  | "bot"
  | "system";

interface AdminProps {
  admin: {
    id: number;
    username: string;
    email: string;
    role: string;
    csrfToken: string;
  };
}

interface OverviewPayload {
  stats: {
    totalUsers: number;
    bannedUsers: number;
    activeSites: number;
    totalSites: number;
    pausedSites: number;
    publishedTemplates: number;
    totalTemplates: number;
    totalComponents: number;
    pendingReferrals: number;
    approvedReferrals: number;
    totalVisits: number;
    unresolvedSecurity: number;
  };
  dailySeries: Array<{ date: string; label: string; visits: number; sites: number }>;
  categoryDistribution: Array<{
    nameAr: string;
    slug: string;
    accentColor: string;
    templatesCount: number;
  }>;
  latestSites: Array<{
    id: number;
    slug: string;
    title: string;
    status: string;
    durationMode: string;
    viewsCount: number;
    createdAt: string;
    ownerName: string;
    templateName: string;
  }>;
  notifications: Array<{ id: string; level: string; title: string; targetTab: string }>;
}

export function AdminDashboardView({ admin }: AdminProps) {
  const router = useRouter();
  const [tab, setTab] = useState<AdminTab>("overview");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Overview state
  const [overview, setOverview] = useState<OverviewPayload | null>(null);

  // Users state
  const [usersList, setUsersList] = useState<Array<Record<string, unknown>>>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userStatus, setUserStatus] = useState("all");
  const [userPage, setUserPage] = useState(1);
  const [userTotalPages, setUserTotalPages] = useState(1);
  const [banModalUser, setBanModalUser] = useState<Record<string, unknown> | null>(null);
  const [banReason, setBanReason] = useState("");
  const [banHours, setBanHours] = useState(48);
  const [banHistoryModal, setBanHistoryModal] = useState<{
    name: string;
    rows: Array<Record<string, unknown>>;
  } | null>(null);

  // Sites state
  const [sitesList, setSitesList] = useState<Array<Record<string, unknown>>>([]);
  const [siteSearch, setSiteSearch] = useState("");
  const [siteStatus, setSiteStatus] = useState("all");
  const [sitePage, setSitePage] = useState(1);
  const [siteTotalPages, setSiteTotalPages] = useState(1);
  const [editSiteModal, setEditSiteModal] = useState<{
    id: number;
    title: string;
    mainMessage: string;
  } | null>(null);
  const [siteEventsModal, setSiteEventsModal] = useState<{
    title: string;
    rows: Array<Record<string, unknown>>;
  } | null>(null);

  // Referrals state
  const [refsList, setRefsList] = useState<Array<Record<string, unknown>>>([]);
  const [ledgerList, setLedgerList] = useState<Array<Record<string, unknown>>>([]);
  const [refStatus, setRefStatus] = useState("all");
  const [refPurpose, setRefPurpose] = useState("all");
  const [refPage, setRefPage] = useState(1);
  const [refTotalPages, setRefTotalPages] = useState(1);
  const [refRules, setRefRules] = useState({
    referralsEnabled: true,
    autoApproveCleanReferrals: false,
    referralsPerCredit: 2,
    creditsPerReward: 1,
    weeklyReferralsForContinuous: 2,
    fixedDurationRequiresCredit: false,
    maxFixedSitesWithoutReferral: 2,
  });

  // Templates state
  const [tplList, setTplList] = useState<Array<Record<string, unknown>>>([]);
  const [tplCats, setTplCats] = useState<Array<{ id: number; nameAr: string; slug: string }>>([]);
  const [tplSearch, setTplSearch] = useState("");
  const [tplCatId, setTplCatId] = useState(0);
  const [tplPage, setTplPage] = useState(1);
  const [tplTotalPages, setTplTotalPages] = useState(1);
  const [newTplModal, setNewTplModal] = useState(false);
  const [newTplForm, setNewTplForm] = useState({
    categoryId: 1,
    slug: "",
    nameAr: "",
    nameEn: "",
    descriptionAr: "",
    previewImage: "/images/cat-love.jpg",
    githubPath: "templates/love/custom-template.json",
    version: "1.0.0",
    tier: "free" as "free" | "premium",
    creditCost: 1,
    sortOrder: 30,
    experienceType: "envelope-letter",
    hero: "cinematic",
    background: "stars",
    gallery: "memory-gallery",
  });
  const [verModal, setVerModal] = useState<{
    id: number;
    nameAr: string;
    currentVersion: string;
    nextVersion: string;
    changelog: string;
  } | null>(null);

  // Bot & System settings state
  const [botForm, setBotForm] = useState({
    botUsername: "LoveCraftMakerBot",
    welcomeMessageAr: "",
    helpMessageAr: "",
    notificationsEnabled: true,
    siteCreationEnabled: true,
    continuousSitesEnabled: true,
    catboxUploadsEnabled: true,
    musicFeatureEnabled: true,
    effects3dEnabled: true,
    durationsCsv: "1, 4, 7, 30",
    dailySiteLimitPerUser: 5,
    monthlySiteLimitPerUser: 20,
  });
  const [sysForm, setSysForm] = useState({
    primaryDomain: "https://lovecraft.app",
    githubOwner: "elsayedhasaneisa1-collab",
    githubRepo: "LOVECRAFT",
    githubBranch: "main",
    githubSyncEnabled: true,
    maxUploadMb: 8,
    apiRateLimitPerMin: 60,
    loginMaxAttempts: 5,
    loginLockoutMinutes: 15,
  });
  const [envStatus, setEnvStatus] = useState<Record<string, boolean>>({});
  const [resources, setResources] = useState<{
    pool: { max: number; total: number; idle: number; waiting: number };
    database: { totalPretty: string; tables: Array<{ name: string; estimatedRows: number; totalPretty: string; indexPretty: string }> };
    retention: Record<string, number>;
    cache: { catalogTemplates: number; pendingAnalyticsEvents: number };
  } | null>(null);
  const [auditLogs, setAuditLogs] = useState<Array<Record<string, unknown>>>([]);
  const [secEvents, setSecEvents] = useState<Array<Record<string, unknown>>>([]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3500);
  };

  const apiMutate = useCallback(
    async (url: string, method: "POST" | "PATCH", body?: unknown) => {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": admin.csrfToken,
        },
        body: body ? JSON.stringify(body) : "{}",
      });
      const data = await res.json();
      if (res.status === 401) {
        router.refresh();
      }
      return { ok: res.ok, data };
    },
    [admin.csrfToken, router]
  );

  const loadOverview = useCallback(async () => {
    const res = await fetch("/api/admin/overview");
    if (res.ok) setOverview(await res.json());
  }, []);

  const loadUsers = useCallback(async () => {
    const sp = new URLSearchParams({
      q: userSearch,
      status: userStatus,
      page: String(userPage),
    });
    const res = await fetch(`/api/admin/users?${sp}`);
    if (res.ok) {
      const d = await res.json();
      setUsersList(d.users || []);
      setUserTotalPages(d.pagination?.totalPages || 1);
    }
  }, [userSearch, userStatus, userPage]);

  const loadSites = useCallback(async () => {
    const sp = new URLSearchParams({
      q: siteSearch,
      status: siteStatus,
      page: String(sitePage),
    });
    const res = await fetch(`/api/admin/sites?${sp}`);
    if (res.ok) {
      const d = await res.json();
      setSitesList(d.sites || []);
      setSiteTotalPages(d.pagination?.totalPages || 1);
    }
  }, [siteSearch, siteStatus, sitePage]);

  const loadReferrals = useCallback(async () => {
    const sp = new URLSearchParams({
      status: refStatus,
      purpose: refPurpose,
      page: String(refPage),
    });
    const res = await fetch(`/api/admin/referrals?${sp}`);
    if (res.ok) {
      const d = await res.json();
      setRefsList(d.referrals || []);
      setLedgerList(d.ledger || []);
      if (d.rules) setRefRules(d.rules);
      setRefTotalPages(d.pagination?.totalPages || 1);
    }
  }, [refStatus, refPurpose, refPage]);

  const loadTemplates = useCallback(async () => {
    const sp = new URLSearchParams({
      q: tplSearch,
      categoryId: String(tplCatId),
      page: String(tplPage),
    });
    const res = await fetch(`/api/admin/templates?${sp}`);
    if (res.ok) {
      const d = await res.json();
      setTplList(d.templates || []);
      setTplCats(d.categories || []);
      if (d.categories?.[0]) {
        setNewTplForm((prev) => ({ ...prev, categoryId: prev.categoryId || d.categories[0].id }));
      }
      setTplTotalPages(d.pagination?.totalPages || 1);
    }
  }, [tplSearch, tplCatId, tplPage]);

  const loadSettings = useCallback(async () => {
    const res = await fetch("/api/admin/settings");
    if (res.ok) {
      const d = await res.json();
      if (d.botSettings) {
        setBotForm({
          botUsername: d.botSettings.botUsername,
          welcomeMessageAr: d.botSettings.welcomeMessageAr,
          helpMessageAr: d.botSettings.helpMessageAr,
          notificationsEnabled: d.botSettings.notificationsEnabled,
          siteCreationEnabled: d.botSettings.siteCreationEnabled,
          continuousSitesEnabled: d.botSettings.continuousSitesEnabled,
          catboxUploadsEnabled: d.botSettings.catboxUploadsEnabled,
          musicFeatureEnabled: d.botSettings.musicFeatureEnabled,
          effects3dEnabled: d.botSettings.effects3dEnabled,
          durationsCsv: (d.botSettings.allowedDurationsDays || [1, 4, 7, 30]).join(", "),
          dailySiteLimitPerUser: d.botSettings.dailySiteLimitPerUser,
          monthlySiteLimitPerUser: d.botSettings.monthlySiteLimitPerUser,
        });
      }
      if (d.systemSettings) {
        setSysForm({
          primaryDomain: d.systemSettings.primaryDomain,
          githubOwner: d.systemSettings.githubOwner,
          githubRepo: d.systemSettings.githubRepo,
          githubBranch: d.systemSettings.githubBranch,
          githubSyncEnabled: d.systemSettings.githubSyncEnabled,
          maxUploadMb: d.systemSettings.maxUploadMb,
          apiRateLimitPerMin: d.systemSettings.apiRateLimitPerMin,
          loginMaxAttempts: d.systemSettings.loginMaxAttempts,
          loginLockoutMinutes: d.systemSettings.loginLockoutMinutes,
        });
      }
      setEnvStatus(d.envStatus || {});
      const resourcesRes = await fetch("/api/admin/resources");
      if (resourcesRes.ok) setResources(await resourcesRes.json());
      setAuditLogs(d.auditLogs || []);
      setSecEvents(d.securityEvents || []);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (tab === "users") loadUsers();
    if (tab === "sites") loadSites();
    if (tab === "referrals") loadReferrals();
    if (tab === "templates") loadTemplates();
    if (tab === "bot" || tab === "system") loadSettings();
  }, [tab, loadUsers, loadSites, loadReferrals, loadTemplates, loadSettings]);

  const handleLogout = async () => {
    await apiMutate("/api/admin/auth/logout", "POST");
    router.refresh();
  };

  const handleExportBackup = async () => {
    const res = await fetch("/api/admin/backup");
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lovecraft-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("تم تصدير النسخة الاحتياطية بنجاح (بدون أي مفاتيح سرية).");
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const txt = await file.text();
      const json = JSON.parse(txt);
      const { ok, data } = await apiMutate("/api/admin/backup", "POST", json);
      showToast(ok ? data.message : data.error || "فشل استعادة النسخة.");
      if (ok) loadSettings();
    } catch {
      showToast("ملف JSON غير صالح.");
    }
    e.target.value = "";
  };

  const isDark = theme === "dark";
  const shellBg = isDark ? "bg-[#090a0f] text-zinc-100" : "bg-slate-50 text-slate-900";
  const panelCls = isDark
    ? "border-white/[0.08] bg-zinc-900/70 text-zinc-100"
    : "border-slate-200 bg-white text-slate-900 shadow-sm";
  const inputCls = isDark
    ? "border-white/10 bg-black/40 text-zinc-100 placeholder-zinc-500"
    : "border-slate-300 bg-white text-slate-900 placeholder-slate-400";

  const navItems: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
    { id: "overview", label: "لوحة الإحصائيات", icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: "users", label: "المستخدمون والحظر", icon: <Users className="h-4 w-4" /> },
    { id: "sites", label: "إدارة المواقع", icon: <Globe className="h-4 w-4" /> },
    { id: "referrals", label: "الإحالات والرصيد", icon: <Share2 className="h-4 w-4" /> },
    { id: "templates", label: "القوالب وGitHub", icon: <Layers className="h-4 w-4" /> },
    { id: "bot", label: "إعدادات البوت", icon: <Bot className="h-4 w-4" /> },
    { id: "system", label: "النظام والأمان", icon: <Settings className="h-4 w-4" /> },
  ];

  const maxVisit = Math.max(1, ...(overview?.dailySeries.map((d) => d.visits) || [1]));

  return (
    <div dir="rtl" className={`min-h-screen w-full transition-colors ${shellBg}`}>
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 left-5 z-50 flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-zinc-900 px-5 py-3 text-xs font-medium text-emerald-300 shadow-2xl">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 right-0 z-40 w-64 transform border-l p-5 transition-transform lg:static lg:translate-x-0 ${
            mobileMenuOpen ? "translate-x-0" : "translate-x-full"
          } ${isDark ? "border-white/[0.07] bg-[#0c0d14]" : "border-slate-200 bg-white"}`}
        >
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
                  isDark ? "border-white/15 bg-white/5" : "border-slate-300 bg-slate-100"
                }`}
              >
                <span className="h-3 w-3 rotate-45 border-[1.5px] border-current" />
              </div>
              <div>
                <p dir="ltr" className="text-xs font-bold tracking-[0.22em]">
                  LOVECRAFT
                </p>
                <p className="text-[11px] opacity-55">الإدارة المركزية</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden"
              aria-label="إغلاق القائمة"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                    active
                      ? isDark
                        ? "bg-zinc-100 text-zinc-950"
                        : "bg-slate-900 text-white"
                      : isDark
                      ? "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-10 border-t border-current/10 pt-5">
            <div className="mb-3 px-2 text-xs opacity-65">
              <p className="font-semibold">{admin.username}</p>
              <p className="truncate opacity-75">{admin.email}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-medium text-red-400 transition hover:bg-red-500/10"
            >
              <LogOut className="h-4 w-4" />
              <span>تسجيل الخروج الآمن</span>
            </button>
          </div>
        </aside>

        {/* Main Workspace */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Topbar */}
          <header
            className={`sticky top-0 z-30 flex items-center justify-between border-b px-5 py-3.5 backdrop-blur-xl ${
              isDark ? "border-white/[0.07] bg-[#090a0f]/85" : "border-slate-200 bg-white/85"
            }`}
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="rounded-lg p-1.5 lg:hidden"
                aria-label="فتح القائمة"
              >
                <Menu className="h-5 w-5" />
              </button>
              <h1 className="text-base font-bold sm:text-lg">
                {navItems.find((n) => n.id === tab)?.label}
              </h1>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Notifications */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotifOpen((o) => !o)}
                  aria-label="الإشعارات"
                  className={`relative cursor-pointer rounded-xl border p-2 ${panelCls}`}
                >
                  <Bell className="h-4 w-4" />
                  {(overview?.notifications.length ?? 0) > 0 && (
                    <span className="absolute -top-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-black">
                      {overview!.notifications.length}
                    </span>
                  )}
                </button>
                {notifOpen && (
                  <div
                    className={`absolute left-0 mt-2 w-72 rounded-2xl border p-3 shadow-2xl ${panelCls}`}
                  >
                    <p className="mb-2 text-xs font-bold opacity-70">التنبيهات الفورية</p>
                    {(overview?.notifications || []).length === 0 ? (
                      <p className="py-3 text-xs opacity-60">جميع الأنظمة مستقرة ولا توجد تنبيهات معلقة.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {overview!.notifications.map((n) => (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => {
                              setTab(n.targetTab as AdminTab);
                              setNotifOpen(false);
                            }}
                            className="w-full cursor-pointer rounded-xl bg-current/5 px-3 py-2 text-right text-xs hover:bg-current/10"
                          >
                            {n.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Dark / Light Mode Toggle */}
              <button
                type="button"
                onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
                aria-label="تبديل المظهر"
                className={`cursor-pointer rounded-xl border p-2 ${panelCls}`}
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
          </header>

          {/* Content Body */}
          <main className="flex-1 space-y-6 p-5 sm:p-7">
            {/* ==================== 1. OVERVIEW ==================== */}
            {tab === "overview" && overview && (
              <>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    {
                      label: "إجمالي المستخدمين",
                      value: overview.stats.totalUsers,
                      sub: `${overview.stats.bannedUsers} حساب محظور`,
                    },
                    {
                      label: "المواقع النشطة حالياً",
                      value: overview.stats.activeSites,
                      sub: `من أصل ${overview.stats.totalSites} موقع (${overview.stats.pausedSites} متوقف)`,
                    },
                    {
                      label: "مكتبة القوالب والعناصر",
                      value: overview.stats.publishedTemplates,
                      sub: `${overview.stats.totalComponents} تصميم عنصر داخلي`,
                    },
                    {
                      label: "الإحالات والزيارات",
                      value: overview.stats.approvedReferrals,
                      sub: `${overview.stats.pendingReferrals} معلقة • ${overview.stats.totalVisits} زيارة`,
                    },
                  ].map((card) => (
                    <div key={card.label} className={`rounded-2xl border p-5 ${panelCls}`}>
                      <p className="text-xs opacity-60">{card.label}</p>
                      <p className="mt-2 text-3xl font-bold tabular-nums">{card.value}</p>
                      <p className="mt-1.5 text-xs opacity-60">{card.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Charts Row */}
                <div className="grid gap-5 lg:grid-cols-12">
                  <div className={`rounded-2xl border p-5 lg:col-span-7 ${panelCls}`}>
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-bold">الزيارات والمواقع المنشأة (آخر 7 أيام)</h2>
                        <p className="text-xs opacity-60">إحصائيات حية من قاعدة البيانات</p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const { ok, data } = await apiMutate(
                            "/api/cron/evaluate-sites",
                            "POST"
                          );
                          if (ok) {
                            showToast(
                              `تم فحص الصلاحيات: ${data.expiredCount} منتهية، ${data.pausedContinuousCount} موقوفة أسبوعياً.`
                            );
                            loadOverview();
                          }
                        }}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-current/15 px-3 py-1.5 text-xs font-medium hover:bg-current/5"
                      >
                        <Activity className="h-3.5 w-3.5" />
                        فحص الصلاحيات الآن
                      </button>
                    </div>

                    <div className="grid h-44 grid-cols-7 items-end gap-3 pt-4">
                      {overview.dailySeries.map((d) => {
                        const hPct = Math.max(8, Math.round((d.visits / maxVisit) * 100));
                        return (
                          <div key={d.date} className="flex h-full flex-col items-center justify-end gap-2">
                            <span className="text-[11px] tabular-nums opacity-70">{d.visits}</span>
                            <div className="flex w-full max-w-[34px] flex-1 items-end rounded-lg bg-current/5 p-0.5">
                              <div
                                style={{ height: `${hPct}%` }}
                                className="w-full rounded-md bg-indigo-500 transition-all"
                              />
                            </div>
                            <span dir="ltr" className="text-[10px] opacity-55">
                              {d.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className={`rounded-2xl border p-5 lg:col-span-5 ${panelCls}`}>
                    <h2 className="mb-4 text-sm font-bold">توزيع القوالب حسب التصنيف</h2>
                    <div className="space-y-3">
                      {overview.categoryDistribution.map((c) => (
                        <div key={c.slug} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>{c.nameAr}</span>
                            <span className="font-semibold tabular-nums">
                              {c.templatesCount} قالب
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-current/10">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(100, c.templatesCount * 4)}%`,
                                backgroundColor: c.accentColor,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Recent Sites Table */}
                <div className={`rounded-2xl border p-5 ${panelCls}`}>
                  <h2 className="mb-4 text-sm font-bold">أحدث المواقع المستقلة</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="border-b border-current/10 opacity-60">
                        <tr>
                          <th className="pb-2.5">العنوان</th>
                          <th className="pb-2.5">المالك</th>
                          <th className="pb-2.5">القالب</th>
                          <th className="pb-2.5">النوع</th>
                          <th className="pb-2.5">الزيارات</th>
                          <th className="pb-2.5">الحالة</th>
                          <th className="pb-2.5">معاينة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-current/5">
                        {overview.latestSites.map((s) => (
                          <tr key={s.id}>
                            <td className="py-3 font-medium">{s.title}</td>
                            <td className="py-3">{s.ownerName}</td>
                            <td className="py-3">{s.templateName}</td>
                            <td className="py-3">
                              {s.durationMode === "continuous" ? "مستمر" : "محدد المدة"}
                            </td>
                            <td className="py-3 tabular-nums">{s.viewsCount}</td>
                            <td className="py-3">
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[11px] ${
                                  s.status === "active"
                                    ? "bg-emerald-500/15 text-emerald-400"
                                    : "bg-amber-500/15 text-amber-400"
                                }`}
                              >
                                {s.status}
                              </span>
                            </td>
                            <td className="py-3">
                              <a
                                href={`/s/${s.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-indigo-400 hover:underline"
                              >
                                <span>/s/{s.slug}</span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* ==================== 2. USERS & BANS ==================== */}
            {tab === "users" && (
              <div className={`space-y-4 rounded-2xl border p-5 ${panelCls}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative min-w-[220px] flex-1">
                    <Search className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 opacity-50" />
                    <input
                      value={userSearch}
                      onChange={(e) => {
                        setUserSearch(e.target.value);
                        setUserPage(1);
                      }}
                      placeholder="بحث بـ Telegram ID أو Username أو الاسم..."
                      className={`w-full rounded-xl border py-2 pr-9 pl-3 text-xs ${inputCls}`}
                    />
                  </div>
                  <select
                    value={userStatus}
                    onChange={(e) => {
                      setUserStatus(e.target.value);
                      setUserPage(1);
                    }}
                    className={`rounded-xl border px-3 py-2 text-xs ${inputCls}`}
                  >
                    <option value="all">جميع الحالات</option>
                    <option value="active">نشط</option>
                    <option value="temp_banned">محظور مؤقتاً</option>
                    <option value="perm_banned">محظور دائماً</option>
                  </select>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="border-b border-current/10 opacity-60">
                      <tr>
                        <th className="pb-2.5">الاسم / Username</th>
                        <th className="pb-2.5">User ID / Chat ID</th>
                        <th className="pb-2.5">التسجيل / آخر نشاط</th>
                        <th className="pb-2.5">المواقع</th>
                        <th className="pb-2.5">الإحالات</th>
                        <th className="pb-2.5">الرصيد</th>
                        <th className="pb-2.5">الحالة</th>
                        <th className="pb-2.5">إجراءات الحظر</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-current/5">
                      {usersList.map((u) => {
                        const statusStr = String(u.accountStatus);
                        const banned = statusStr !== "active";
                        return (
                          <tr key={String(u.id)}>
                            <td className="py-3">
                              <div className="font-semibold">
                                {String(u.firstName)} {u.lastName ? String(u.lastName) : ""}
                              </div>
                              <div dir="ltr" className="text-[11px] opacity-60">
                                {u.username ? `@${String(u.username)}` : "—"}
                              </div>
                            </td>
                            <td dir="ltr" className="py-3 font-mono text-[11px]">
                              <div>U: {String(u.telegramUserId)}</div>
                              <div className="opacity-60">C: {String(u.telegramChatId)}</div>
                            </td>
                            <td dir="ltr" className="py-3 text-[11px] opacity-75">
                              <div>{String(u.createdAt).slice(0, 10)}</div>
                              <div className="opacity-60">{String(u.lastActiveAt).slice(0, 16).replace("T", " ")}</div>
                            </td>
                            <td className="py-3 tabular-nums">{String(u.sitesCount)}</td>
                            <td className="py-3 tabular-nums">
                              {String(u.referralsApproved)} / {String(u.referralsTotal)}
                            </td>
                            <td className="py-3 font-bold tabular-nums">{String(u.balance)}</td>
                            <td className="py-3">
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[11px] ${
                                  !banned
                                    ? "bg-emerald-500/15 text-emerald-400"
                                    : "bg-red-500/15 text-red-400"
                                }`}
                              >
                                {statusStr === "active"
                                  ? "نشط"
                                  : statusStr === "temp_banned"
                                  ? "حظر مؤقت"
                                  : "حظر دائم"}
                              </span>
                            </td>
                            <td className="py-3">
                              <div className="flex items-center gap-1.5">
                                {banned ? (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const { ok, data } = await apiMutate(
                                        "/api/admin/users",
                                        "POST",
                                        { userId: Number(u.id), action: "unban" }
                                      );
                                      if (ok) {
                                        showToast(data.message);
                                        loadUsers();
                                        loadOverview();
                                      }
                                    }}
                                    className="cursor-pointer rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] text-white"
                                  >
                                    فك الحظر
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setBanModalUser(u);
                                      setBanReason("");
                                    }}
                                    className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-red-500/15 px-2.5 py-1 text-[11px] text-red-400 hover:bg-red-500/25"
                                  >
                                    <Ban className="h-3 w-3" />
                                    حظر
                                  </button>
                                )}
                                <button
                                  type="button"
                                  title="سجل الحظر التاريخي"
                                  onClick={async () => {
                                    const res = await fetch(
                                      `/api/admin/users?banHistoryUserId=${String(u.id)}`
                                    );
                                    if (res.ok) {
                                      const d = await res.json();
                                      setBanHistoryModal({
                                        name: String(u.firstName),
                                        rows: d.banHistory || [],
                                      });
                                    }
                                  }}
                                  className="cursor-pointer rounded-lg border border-current/15 p-1 hover:bg-current/10"
                                >
                                  <History className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <PaginationBar page={userPage} totalPages={userTotalPages} onChange={setUserPage} />
              </div>
            )}

            {/* ==================== 3. SITES MANAGEMENT ==================== */}
            {tab === "sites" && (
              <div className={`space-y-4 rounded-2xl border p-5 ${panelCls}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative min-w-[220px] flex-1">
                    <Search className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 opacity-50" />
                    <input
                      value={siteSearch}
                      onChange={(e) => {
                        setSiteSearch(e.target.value);
                        setSitePage(1);
                      }}
                      placeholder="بحث بالعنوان، الرابط، صاحب الموقع، أو القالب..."
                      className={`w-full rounded-xl border py-2 pr-9 pl-3 text-xs ${inputCls}`}
                    />
                  </div>
                  <select
                    value={siteStatus}
                    onChange={(e) => {
                      setSiteStatus(e.target.value);
                      setSitePage(1);
                    }}
                    className={`rounded-xl border px-3 py-2 text-xs ${inputCls}`}
                  >
                    <option value="all">جميع المواقع غير المحذوفة</option>
                    <option value="active">نشط</option>
                    <option value="expired">منتهي الصلاحية</option>
                    <option value="paused_referrals">متوقف (إحالات أسبوعية)</option>
                    <option value="paused_admin">متوقف إدارياً</option>
                    <option value="deleted">محذوف</option>
                  </select>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="border-b border-current/10 opacity-60">
                      <tr>
                        <th className="pb-2.5">الموقع</th>
                        <th className="pb-2.5">المالك</th>
                        <th className="pb-2.5">القالب / الإصدار</th>
                        <th className="pb-2.5">الصلاحية</th>
                        <th className="pb-2.5">الحالة</th>
                        <th className="pb-2.5">العمليات الإدارية</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-current/5">
                      {sitesList.map((s) => {
                        const id = Number(s.id);
                        const st = String(s.status);
                        const hidden = Boolean(s.isHidden);
                        return (
                          <tr key={id}>
                            <td className="py-3">
                              <div className="font-semibold">{String(s.title)}</div>
                              <a
                                href={`/s/${String(s.slug)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                dir="ltr"
                                className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:underline"
                              >
                                /s/{String(s.slug)}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </td>
                            <td className="py-3">
                              <div>{String(s.ownerFirstName)}</div>
                              <div dir="ltr" className="font-mono text-[10px] opacity-60">
                                {String(s.ownerTelegramId)}
                              </div>
                            </td>
                            <td className="py-3">
                              <div>{String(s.templateNameAr)}</div>
                              <div className="font-mono text-[10px] opacity-60">
                                v{String(s.pinnedVersion)}
                              </div>
                            </td>
                            <td className="py-3 text-[11px]">
                              {s.durationMode === "continuous" ? (
                                <span>
                                  مستمر ({String(s.completedWeekly ?? 0)}/
                                  {String(s.requiredWeekly ?? 2)} أسبوعياً)
                                </span>
                              ) : (
                                <span dir="ltr">
                                  {s.expiresAt
                                    ? String(s.expiresAt).slice(0, 10)
                                    : `${String(s.durationDays)}d`}
                                </span>
                              )}
                            </td>
                            <td className="py-3">
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[11px] ${
                                  st === "active" && !hidden
                                    ? "bg-emerald-500/15 text-emerald-400"
                                    : "bg-amber-500/15 text-amber-400"
                                }`}
                              >
                                {hidden ? "مخفي" : st}
                              </span>
                            </td>
                            <td className="py-3">
                              <div className="flex flex-wrap items-center gap-1">
                                <button
                                  type="button"
                                  title="تعديل إداري"
                                  onClick={() =>
                                    setEditSiteModal({
                                      id,
                                      title: String(s.title),
                                      mainMessage: String(s.mainMessage || ""),
                                    })
                                  }
                                  className="cursor-pointer rounded-lg border border-current/15 p-1.5 hover:bg-current/10"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  title={hidden ? "إظهار" : "إخفاء"}
                                  onClick={async () => {
                                    await apiMutate("/api/admin/sites", "PATCH", {
                                      siteId: id,
                                      action: hidden ? "unhide" : "hide",
                                    });
                                    loadSites();
                                  }}
                                  className="cursor-pointer rounded-lg border border-current/15 p-1.5 hover:bg-current/10"
                                >
                                  {hidden ? (
                                    <Eye className="h-3.5 w-3.5" />
                                  ) : (
                                    <EyeOff className="h-3.5 w-3.5" />
                                  )}
                                </button>
                                {st === "active" ? (
                                  <button
                                    type="button"
                                    title="إيقاف الموقع"
                                    onClick={async () => {
                                      await apiMutate("/api/admin/sites", "PATCH", {
                                        siteId: id,
                                        action: "pause",
                                      });
                                      showToast("تم إيقاف الموقع.");
                                      loadSites();
                                    }}
                                    className="cursor-pointer rounded-lg border border-amber-500/30 p-1.5 text-amber-400"
                                  >
                                    <Pause className="h-3.5 w-3.5" />
                                  </button>
                                ) : st !== "deleted" ? (
                                  <button
                                    type="button"
                                    title="إعادة تشغيل يدوي"
                                    onClick={async () => {
                                      await apiMutate("/api/admin/sites", "PATCH", {
                                        siteId: id,
                                        action: "resume",
                                        extendDays: 7,
                                      });
                                      showToast("تمت إعادة تشغيل الموقع يدوياً.");
                                      loadSites();
                                    }}
                                    className="cursor-pointer rounded-lg border border-emerald-500/30 p-1.5 text-emerald-400"
                                  >
                                    <Play className="h-3.5 w-3.5" />
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  title="سجل العمليات"
                                  onClick={async () => {
                                    const res = await fetch(`/api/admin/sites?eventsSiteId=${id}`);
                                    if (res.ok) {
                                      const d = await res.json();
                                      setSiteEventsModal({
                                        title: String(s.title),
                                        rows: d.events || [],
                                      });
                                    }
                                  }}
                                  className="cursor-pointer rounded-lg border border-current/15 p-1.5 hover:bg-current/10"
                                >
                                  <History className="h-3.5 w-3.5" />
                                </button>
                                {st !== "deleted" && (
                                  <button
                                    type="button"
                                    title="حذف نهائي"
                                    onClick={async () => {
                                      await apiMutate("/api/admin/sites", "PATCH", {
                                        siteId: id,
                                        action: "delete",
                                      });
                                      showToast("تم حذف الموقع دون استرجاع رصيد.");
                                      loadSites();
                                      loadOverview();
                                    }}
                                    className="cursor-pointer rounded-lg border border-red-500/30 p-1.5 text-red-400"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <PaginationBar page={sitePage} totalPages={siteTotalPages} onChange={setSitePage} />
              </div>
            )}

            {/* ==================== 4. REFERRALS & LEDGER ==================== */}
            {tab === "referrals" && (
              <div className="space-y-6">
                {/* Rules Configuration */}
                <div className={`rounded-2xl border p-5 ${panelCls}`}>
                  <h2 className="mb-4 text-sm font-bold">شروط مكافآت الإنشاء والإحالات الأسبوعية</h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="space-y-1 text-xs">
                      <span className="opacity-70">عدد الإحالات لكل مكافأة رصيد</span>
                      <input
                        type="number"
                        min={1}
                        value={refRules.referralsPerCredit}
                        onChange={(e) =>
                          setRefRules({ ...refRules, referralsPerCredit: Number(e.target.value) })
                        }
                        className={`w-full rounded-xl border px-3 py-2 ${inputCls}`}
                      />
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="opacity-70">الرصيد الممنوح عند الإكمال</span>
                      <input
                        type="number"
                        min={1}
                        value={refRules.creditsPerReward}
                        onChange={(e) =>
                          setRefRules({ ...refRules, creditsPerReward: Number(e.target.value) })
                        }
                        className={`w-full rounded-xl border px-3 py-2 ${inputCls}`}
                      />
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="opacity-70">الإحالات الأسبوعية للمواقع المستمرة</span>
                      <input
                        type="number"
                        min={1}
                        value={refRules.weeklyReferralsForContinuous}
                        onChange={(e) =>
                          setRefRules({
                            ...refRules,
                            weeklyReferralsForContinuous: Number(e.target.value),
                          })
                        }
                        className={`w-full rounded-xl border px-3 py-2 ${inputCls}`}
                      />
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="opacity-70">مواقع محددة المدة بدون إحالات</span>
                      <input
                        type="number"
                        min={0}
                        value={refRules.maxFixedSitesWithoutReferral}
                        onChange={(e) =>
                          setRefRules({
                            ...refRules,
                            maxFixedSitesWithoutReferral: Number(e.target.value),
                          })
                        }
                        className={`w-full rounded-xl border px-3 py-2 ${inputCls}`}
                      />
                    </label>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap gap-5 text-xs">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={refRules.referralsEnabled}
                          onChange={(e) =>
                            setRefRules({ ...refRules, referralsEnabled: e.target.checked })
                          }
                        />
                        <span>تفعيل نظام الإحالات</span>
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={refRules.autoApproveCleanReferrals}
                          onChange={(e) =>
                            setRefRules({
                              ...refRules,
                              autoApproveCleanReferrals: e.target.checked,
                            })
                          }
                        />
                        <span>اعتماد تلقائي للإحالات السليمة</span>
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        const { ok, data } = await apiMutate("/api/admin/referrals", "POST", {
                          mode: "update_rules",
                          ...refRules,
                        });
                        showToast(ok ? data.message : data.error);
                      }}
                      className="cursor-pointer rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
                    >
                      حفظ شروط الإحالات
                    </button>
                  </div>
                </div>

                {/* Referrals Review Table */}
                <div className={`space-y-4 rounded-2xl border p-5 ${panelCls}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-sm font-bold">مراجعة الإحالات المسجلة</h2>
                    <div className="flex gap-2">
                      <select
                        value={refStatus}
                        onChange={(e) => {
                          setRefStatus(e.target.value);
                          setRefPage(1);
                        }}
                        className={`rounded-xl border px-3 py-1.5 text-xs ${inputCls}`}
                      >
                        <option value="all">جميع الحالات</option>
                        <option value="pending">معلقة</option>
                        <option value="suspicious">مشبوهة</option>
                        <option value="approved">معتمدة (ناجحة)</option>
                        <option value="rejected">مرفوضة</option>
                      </select>
                      <select
                        value={refPurpose}
                        onChange={(e) => {
                          setRefPurpose(e.target.value);
                          setRefPage(1);
                        }}
                        className={`rounded-xl border px-3 py-1.5 text-xs ${inputCls}`}
                      >
                        <option value="all">جميع الأنواع</option>
                        <option value="creation_credit">رصيد إنشاء</option>
                        <option value="weekly_renewal">استمرار أسبوعي</option>
                      </select>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="border-b border-current/10 opacity-60">
                        <tr>
                          <th className="pb-2.5">#</th>
                          <th className="pb-2.5">الداعي</th>
                          <th className="pb-2.5">المدعو</th>
                          <th className="pb-2.5">الغرض</th>
                          <th className="pb-2.5">الحالة</th>
                          <th className="pb-2.5">المراجعة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-current/5">
                        {refsList.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-6 text-center opacity-55">
                              لا توجد إحالات مطابقة للفلتر الحالي.
                            </td>
                          </tr>
                        ) : (
                          refsList.map((r) => {
                            const referrer = r.referrer as { name: string; telegramUserId: number };
                            const referred = r.referred as { name: string; telegramUserId: number };
                            const st = String(r.status);
                            return (
                              <tr key={String(r.id)}>
                                <td className="py-3 font-mono">{String(r.id)}</td>
                                <td className="py-3">
                                  {referrer.name}{" "}
                                  <span className="font-mono text-[10px] opacity-60">
                                    ({referrer.telegramUserId})
                                  </span>
                                </td>
                                <td className="py-3">
                                  {referred.name}{" "}
                                  <span className="font-mono text-[10px] opacity-60">
                                    ({referred.telegramUserId})
                                  </span>
                                </td>
                                <td className="py-3">
                                  {r.purpose === "weekly_renewal"
                                    ? `أسبوعي (${String(r.targetSiteSlug || "مستمر")})`
                                    : "مكافأة رصيد إنشاء"}
                                </td>
                                <td className="py-3">
                                  <span className="rounded-full bg-current/10 px-2.5 py-0.5 text-[11px]">
                                    {st}
                                  </span>
                                </td>
                                <td className="py-3">
                                  {st === "pending" || st === "suspicious" ? (
                                    <div className="flex gap-1.5">
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          const { data } = await apiMutate(
                                            "/api/admin/referrals",
                                            "POST",
                                            {
                                              mode: "review",
                                              referralId: Number(r.id),
                                              decision: "approved",
                                            }
                                          );
                                          showToast(data.message);
                                          loadReferrals();
                                          loadOverview();
                                        }}
                                        className="cursor-pointer rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] text-white"
                                      >
                                        اعتماد
                                      </button>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          const { data } = await apiMutate(
                                            "/api/admin/referrals",
                                            "POST",
                                            {
                                              mode: "review",
                                              referralId: Number(r.id),
                                              decision: "rejected",
                                            }
                                          );
                                          showToast(data.message);
                                          loadReferrals();
                                        }}
                                        className="cursor-pointer rounded-lg bg-red-600/80 px-2.5 py-1 text-[11px] text-white"
                                      >
                                        رفض
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-[11px] opacity-55">تمت المراجعة</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  <PaginationBar page={refPage} totalPages={refTotalPages} onChange={setRefPage} />
                </div>

                {/* Transaction Ledger */}
                <div className={`rounded-2xl border p-5 ${panelCls}`}>
                  <h2 className="mb-3 text-sm font-bold">سجل معاملات الرصيد (Transaction Ledger)</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="border-b border-current/10 opacity-60">
                        <tr>
                          <th className="pb-2">المستخدم</th>
                          <th className="pb-2">النوع</th>
                          <th className="pb-2">المقدار</th>
                          <th className="pb-2">الرصيد بعد</th>
                          <th className="pb-2">البيان</th>
                          <th className="pb-2">التاريخ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-current/5">
                        {ledgerList.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-5 text-center opacity-55">
                              لا توجد معاملات مسجلة بعد.
                            </td>
                          </tr>
                        ) : (
                          ledgerList.map((tx) => (
                            <tr key={String(tx.id)}>
                              <td className="py-2.5">{String(tx.userName)}</td>
                              <td className="py-2.5 font-mono text-[11px]">{String(tx.txType)}</td>
                              <td
                                dir="ltr"
                                className={`py-2.5 font-mono font-bold ${
                                  Number(tx.amount) > 0
                                    ? "text-emerald-400"
                                    : Number(tx.amount) < 0
                                    ? "text-amber-400"
                                    : "opacity-60"
                                }`}
                              >
                                {Number(tx.amount) > 0 ? `+${String(tx.amount)}` : String(tx.amount)}
                              </td>
                              <td className="py-2.5 font-mono">{String(tx.balanceAfter)}</td>
                              <td className="py-2.5">{String(tx.description)}</td>
                              <td dir="ltr" className="py-2.5 text-[11px] opacity-60">
                                {String(tx.createdAt).slice(0, 16).replace("T", " ")}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== 5. TEMPLATES & GITHUB ==================== */}
            {tab === "templates" && (
              <div className={`space-y-4 rounded-2xl border p-5 ${panelCls}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-1 flex-wrap gap-2">
                    <input
                      value={tplSearch}
                      onChange={(e) => {
                        setTplSearch(e.target.value);
                        setTplPage(1);
                      }}
                      placeholder="بحث في القوالب أو مسار GitHub..."
                      className={`min-w-[200px] flex-1 rounded-xl border px-3 py-2 text-xs ${inputCls}`}
                    />
                    <select
                      value={tplCatId}
                      onChange={(e) => {
                        setTplCatId(Number(e.target.value));
                        setTplPage(1);
                      }}
                      className={`rounded-xl border px-3 py-2 text-xs ${inputCls}`}
                    >
                      <option value={0}>جميع التصنيفات</option>
                      {tplCats.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nameAr}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        const { data } = await apiMutate("/api/admin/templates", "POST", {
                          mode: "sync_github",
                        });
                        showToast(data.message || data.error || "تعذرت المزامنة.");
                        loadTemplates();
                      }}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-current/15 px-3 py-2 text-xs font-medium hover:bg-current/5"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      مزامنة GitHub
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewTplModal(true)}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      إضافة قالب جديد
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="border-b border-current/10 opacity-60">
                      <tr>
                        <th className="pb-2.5">القالب</th>
                        <th className="pb-2.5">مسار GitHub</th>
                        <th className="pb-2.5">الإصدار</th>
                        <th className="pb-2.5">الفئة</th>
                        <th className="pb-2.5">الترتيب</th>
                        <th className="pb-2.5">النشر</th>
                        <th className="pb-2.5">إدارة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-current/5">
                      {tplList.map((t) => {
                        const id = Number(t.id);
                        const pub = Boolean(t.isPublished);
                        const tier = String(t.tier);
                        return (
                          <tr key={id}>
                            <td className="py-3">
                              <div className="font-semibold">{String(t.nameAr)}</div>
                              <div dir="ltr" className="text-[10px] opacity-60">
                                {String(t.slug)} • {String(t.experienceType)}
                              </div>
                            </td>
                            <td dir="ltr" className="py-3 font-mono text-[10px] opacity-70">
                              {String(t.githubPath)}
                            </td>
                            <td className="py-3 font-mono text-[11px]">
                              v{String(t.currentVersion)}
                            </td>
                            <td className="py-3">
                              <button
                                type="button"
                                onClick={async () => {
                                  const nextTier = tier === "free" ? "premium" : "free";
                                  await apiMutate("/api/admin/templates", "PATCH", {
                                    templateId: id,
                                    tier: nextTier,
                                    creditCost: nextTier === "premium" ? 2 : 1,
                                  });
                                  loadTemplates();
                                }}
                                className={`cursor-pointer rounded-full px-2.5 py-0.5 text-[11px] ${
                                  tier === "premium"
                                    ? "bg-amber-500/15 text-amber-400"
                                    : "bg-current/10"
                                }`}
                              >
                                {tier === "premium" ? "مميز" : "مجاني"}
                              </button>
                            </td>
                            <td className="py-3 tabular-nums">{String(t.sortOrder)}</td>
                            <td className="py-3">
                              <button
                                type="button"
                                onClick={async () => {
                                  await apiMutate("/api/admin/templates", "PATCH", {
                                    templateId: id,
                                    isPublished: !pub,
                                  });
                                  showToast(pub ? "تم إخفاء القالب." : "تم نشر القالب.");
                                  loadTemplates();
                                }}
                                className={`cursor-pointer rounded-full px-2.5 py-0.5 text-[11px] ${
                                  pub
                                    ? "bg-emerald-500/15 text-emerald-400"
                                    : "bg-zinc-500/20 text-zinc-400"
                                }`}
                              >
                                {pub ? "منشور" : "مخفي"}
                              </button>
                            </td>
                            <td className="py-3">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const parts = String(t.currentVersion).split(".").map(Number);
                                    const nextV = `${parts[0] || 1}.${(parts[1] || 0) + 1}.0`;
                                    setVerModal({
                                      id,
                                      nameAr: String(t.nameAr),
                                      currentVersion: String(t.currentVersion),
                                      nextVersion: nextV,
                                      changelog: "",
                                    });
                                  }}
                                  className="cursor-pointer rounded-lg border border-current/15 px-2 py-1 text-[11px] hover:bg-current/10"
                                >
                                  إصدار جديد
                                </button>
                                <a
                                  href={`/preview/${String(t.slug)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-indigo-400 hover:underline"
                                >
                                  معاينة
                                </a>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <PaginationBar page={tplPage} totalPages={tplTotalPages} onChange={setTplPage} />
              </div>
            )}

            {/* ==================== 6. BOT SETTINGS ==================== */}
            {tab === "bot" && (
              <div className={`space-y-5 rounded-2xl border p-6 ${panelCls}`}>
                <h2 className="text-sm font-bold">إعدادات Telegram Bot وحدود الاستخدام</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="space-y-1 text-xs">
                    <span className="opacity-70">معرّف البوت (بدون @)</span>
                    <input
                      dir="ltr"
                      value={botForm.botUsername}
                      onChange={(e) => setBotForm({ ...botForm, botUsername: e.target.value })}
                      className={`w-full rounded-xl border px-3 py-2 ${inputCls}`}
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="opacity-70">المدد المتاحة بالأيام (مفصولة بفاصلة)</span>
                    <input
                      dir="ltr"
                      value={botForm.durationsCsv}
                      onChange={(e) => setBotForm({ ...botForm, durationsCsv: e.target.value })}
                      className={`w-full rounded-xl border px-3 py-2 ${inputCls}`}
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="opacity-70">الحد اليومي لكل مستخدم</span>
                    <input
                      type="number"
                      min={1}
                      value={botForm.dailySiteLimitPerUser}
                      onChange={(e) =>
                        setBotForm({ ...botForm, dailySiteLimitPerUser: Number(e.target.value) })
                      }
                      className={`w-full rounded-xl border px-3 py-2 ${inputCls}`}
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="opacity-70">الحد الشهري لكل مستخدم</span>
                    <input
                      type="number"
                      min={1}
                      value={botForm.monthlySiteLimitPerUser}
                      onChange={(e) =>
                        setBotForm({ ...botForm, monthlySiteLimitPerUser: Number(e.target.value) })
                      }
                      className={`w-full rounded-xl border px-3 py-2 ${inputCls}`}
                    />
                  </label>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <label className="space-y-1 text-xs">
                    <span className="opacity-70">رسالة الترحيب الرئيسية</span>
                    <textarea
                      rows={4}
                      value={botForm.welcomeMessageAr}
                      onChange={(e) => setBotForm({ ...botForm, welcomeMessageAr: e.target.value })}
                      className={`w-full rounded-xl border p-3 ${inputCls}`}
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="opacity-70">رسالة المساعدة والتعليمات</span>
                    <textarea
                      rows={4}
                      value={botForm.helpMessageAr}
                      onChange={(e) => setBotForm({ ...botForm, helpMessageAr: e.target.value })}
                      className={`w-full rounded-xl border p-3 ${inputCls}`}
                    />
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 text-xs">
                  {(
                    [
                      ["siteCreationEnabled", "تفعيل إنشاء المواقع الجديدة"],
                      ["continuousSitesEnabled", "تفعيل المواقع المستمرة الأسبوعية"],
                      ["catboxUploadsEnabled", "تفعيل رفع الصور عبر Catbox"],
                      ["musicFeatureEnabled", "تفعيل الموسيقى الاختيارية"],
                      ["effects3dEnabled", "تفعيل مؤثرات 3D المتقدمة"],
                      ["notificationsEnabled", "تفعيل إشعارات البوت"],
                    ] as const
                  ).map(([key, label]) => (
                    <label
                      key={key}
                      className="flex items-center gap-2.5 rounded-xl border border-current/10 p-3"
                    >
                      <input
                        type="checkbox"
                        checked={botForm[key]}
                        onChange={(e) => setBotForm({ ...botForm, [key]: e.target.checked })}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    const days = botForm.durationsCsv
                      .split(",")
                      .map((n) => Number(n.trim()))
                      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 365);
                    const { ok, data } = await apiMutate("/api/admin/settings", "PATCH", {
                      section: "bot",
                      ...botForm,
                      allowedDurationsDays: days.length > 0 ? days : [1, 4, 7, 30],
                    });
                    showToast(ok ? data.message : data.error);
                  }}
                  className="cursor-pointer rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500"
                >
                  حفظ إعدادات البوت
                </button>
              </div>
            )}

            {/* ==================== 7. SYSTEM, SECURITY, BACKUP & AUDIT ==================== */}
            {tab === "system" && (
              <div className="space-y-6">
                {/* Integrations & Security Parameters */}
                <div className={`space-y-5 rounded-2xl border p-6 ${panelCls}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="inline-flex items-center gap-2 text-sm font-bold">
                      <FolderGit2 className="h-4 w-4" />
                      تكامل GitHub وCatbox والدومين والحماية
                    </h2>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleExportBackup}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-current/15 px-3 py-1.5 text-xs hover:bg-current/5"
                      >
                        <Download className="h-3.5 w-3.5" />
                        تصدير نسخة احتياطية
                      </button>
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-current/15 px-3 py-1.5 text-xs hover:bg-current/5">
                        <Upload className="h-3.5 w-3.5" />
                        <span>استعادة نسخة</span>
                        <input
                          type="file"
                          accept="application/json"
                          onChange={handleImportBackup}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="space-y-1 text-xs">
                      <span className="opacity-70">النطاق الأساسي (Domain)</span>
                      <input
                        dir="ltr"
                        value={sysForm.primaryDomain}
                        onChange={(e) => setSysForm({ ...sysForm, primaryDomain: e.target.value })}
                        className={`w-full rounded-xl border px-3 py-2 ${inputCls}`}
                      />
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="opacity-70">GitHub Owner</span>
                      <input
                        dir="ltr"
                        value={sysForm.githubOwner}
                        onChange={(e) => setSysForm({ ...sysForm, githubOwner: e.target.value })}
                        className={`w-full rounded-xl border px-3 py-2 ${inputCls}`}
                      />
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="opacity-70">GitHub Repository</span>
                      <input
                        dir="ltr"
                        value={sysForm.githubRepo}
                        onChange={(e) => setSysForm({ ...sysForm, githubRepo: e.target.value })}
                        className={`w-full rounded-xl border px-3 py-2 ${inputCls}`}
                      />
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="opacity-70">حد صور Catbox (MB)</span>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={sysForm.maxUploadMb}
                        onChange={(e) =>
                          setSysForm({ ...sysForm, maxUploadMb: Number(e.target.value) })
                        }
                        className={`w-full rounded-xl border px-3 py-2 ${inputCls}`}
                      />
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="opacity-70">حد محاولات الدخول قبل القفل</span>
                      <input
                        type="number"
                        min={3}
                        max={15}
                        value={sysForm.loginMaxAttempts}
                        onChange={(e) =>
                          setSysForm({ ...sysForm, loginMaxAttempts: Number(e.target.value) })
                        }
                        className={`w-full rounded-xl border px-3 py-2 ${inputCls}`}
                      />
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="opacity-70">مدة القفل المؤقت (دقيقة)</span>
                      <input
                        type="number"
                        min={5}
                        max={180}
                        value={sysForm.loginLockoutMinutes}
                        onChange={(e) =>
                          setSysForm({ ...sysForm, loginLockoutMinutes: Number(e.target.value) })
                        }
                        className={`w-full rounded-xl border px-3 py-2 ${inputCls}`}
                      />
                    </label>
                  </div>

                  {/* Masked Env Secret Presence Indicators (NEVER exposes raw values!) */}
                  <div className="rounded-xl border border-current/10 p-4">
                    <p className="mb-2.5 text-xs font-semibold opacity-75">
                      حالة متغيرات البيئة السرية (لا تُعرض المفاتيح أو الـ Tokens أبداً في الواجهة)
                    </p>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      {[
                        ["databaseConnected", "PostgreSQL"],
                        ["telegramBotTokenConfigured", "TELEGRAM_BOT_TOKEN"],
                        ["telegramWebhookSecretConfigured", "WEBHOOK_SECRET"],
                        ["botApiSecretConfigured", "BOT_API_SECRET"],
                        ["githubTokenConfigured", "GITHUB_TOKEN"],
                        ["catboxUserhashConfigured", "CATBOX_USERHASH"],
                        ["cronSecretConfigured", "CRON_SECRET"],
                      ].map(([k, label]) => (
                        <span
                          key={k}
                          dir="ltr"
                          className={`rounded-full px-3 py-1 font-mono ${
                            envStatus[k]
                              ? "bg-emerald-500/15 text-emerald-400"
                              : "bg-current/10 opacity-65"
                          }`}
                        >
                          {label}: {envStatus[k] ? "SET" : "ENV"}
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      const { ok, data } = await apiMutate("/api/admin/settings", "PATCH", {
                        section: "system",
                        ...sysForm,
                      });
                      showToast(ok ? data.message : data.error);
                    }}
                    className="cursor-pointer rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500"
                  >
                    حفظ إعدادات النظام والأمان
                  </button>
                </div>

                {/* Live Resource Footprint */}
                {resources && (
                  <div className={`rounded-2xl border p-5 ${panelCls}`}>
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <h3 className="inline-flex items-center gap-2 text-sm font-bold">
                        <Activity className="h-4 w-4 text-sky-400" />
                        موارد قاعدة البيانات
                      </h3>
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await fetch("/api/admin/resources");
                          if (res.ok) setResources(await res.json());
                        }}
                        className="cursor-pointer rounded-lg border border-current/15 px-2.5 py-1 text-[11px] hover:bg-current/10"
                      >
                        <RefreshCw className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded-xl border border-current/10 p-3">
                        <p className="text-[11px] opacity-60">حجم القاعدة</p>
                        <p className="mt-1 text-base font-bold">{resources.database.totalPretty}</p>
                      </div>
                      <div className="rounded-xl border border-current/10 p-3">
                        <p className="text-[11px] opacity-60">اتصالات نشطة</p>
                        <p className="mt-1 text-base font-bold">
                          {resources.pool.idle}/{resources.pool.max}
                        </p>
                        <p className="text-[10px] opacity-55">في الانتظار: {resources.pool.waiting}</p>
                      </div>
                      <div className="rounded-xl border border-current/10 p-3">
                        <p className="text-[11px] opacity-60">قوالب في الكاش</p>
                        <p className="mt-1 text-base font-bold">{resources.cache.catalogTemplates}</p>
                      </div>
                      <div className="rounded-xl border border-current/10 p-3">
                        <p className="text-[11px] opacity-60">أحداث انتظارFlush</p>
                        <p className="mt-1 text-base font-bold">{resources.cache.pendingAnalyticsEvents}</p>
                      </div>
                    </div>

                    <div className="max-h-56 overflow-y-auto text-xs">
                      <table className="w-full text-right">
                        <thead className="opacity-60">
                          <tr>
                            <th className="pb-2">الجدول</th>
                            <th className="pb-2">الصفوف (تقديري)</th>
                            <th className="pb-2">الحجم</th>
                            <th className="pb-2">الفهارس</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-current/5">
                          {resources.database.tables.map((t) => (
                            <tr key={t.name}>
                              <td className="py-1.5 font-mono text-[11px]">{t.name}</td>
                              <td className="py-1.5 tabular-nums">{t.estimatedRows}</td>
                              <td className="py-1.5 tabular-nums">{t.totalPretty}</td>
                              <td className="py-1.5 opacity-70">{t.indexPretty}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <p className="mt-3 text-[11px] leading-relaxed opacity-60">
                      الاحتفاظ التلقائي: سجل الزيارات الخام {resources.retention.rawVisitDays} أيام،
                      علامات الزوار {resources.retention.visitMarkDays} أيام، الجلسات المنتهية{" "}
                      {resources.retention.expiredSessionDays} يوم، الأحداث الأمنية المراجَعة{" "}
                      {resources.retention.resolvedSecurityDays} يوم. سجل معاملات الرصيد والإحالات
                      محفوظ دائمًا كسجل مالي.
                    </p>
                  </div>
                )}

                {/* Audit Logs & Security Events */}
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className={`rounded-2xl border p-5 ${panelCls}`}>
                    <h3 className="mb-3 inline-flex items-center gap-2 text-sm font-bold">
                      <ShieldAlert className="h-4 w-4 text-amber-400" />
                      الأحداث الأمنية (Security Events)
                    </h3>
                    <div className="max-h-72 space-y-2 overflow-y-auto text-xs">
                      {secEvents.length === 0 ? (
                        <p className="py-4 opacity-55">لا توجد أحداث أمنية مسجلة.</p>
                      ) : (
                        secEvents.map((ev) => (
                          <div
                            key={String(ev.id)}
                            className="flex items-center justify-between gap-2 rounded-xl border border-current/10 p-3"
                          >
                            <div>
                              <div className="font-mono font-semibold">{String(ev.eventType)}</div>
                              <div dir="ltr" className="text-[10px] opacity-60">
                                {String(ev.severity)} • IP: {String(ev.ipAddress || "—")} •{" "}
                                {String(ev.createdAt).slice(0, 16).replace("T", " ")}
                              </div>
                            </div>
                            {!ev.isResolved && (
                              <button
                                type="button"
                                onClick={async () => {
                                  await apiMutate("/api/admin/settings", "PATCH", {
                                    section: "resolve_security",
                                    eventId: Number(ev.id),
                                  });
                                  loadSettings();
                                  loadOverview();
                                }}
                                className="cursor-pointer rounded-lg bg-emerald-600/20 p-1.5 text-emerald-400"
                                title="تعليم كمُراجَع"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className={`rounded-2xl border p-5 ${panelCls}`}>
                    <h3 className="mb-3 text-sm font-bold">سجل تدقيق الإدارة (Audit Logs)</h3>
                    <div className="max-h-72 space-y-2 overflow-y-auto text-xs">
                      {auditLogs.map((log) => (
                        <div
                          key={String(log.id)}
                          className="rounded-xl border border-current/10 p-3"
                        >
                          <div className="flex justify-between">
                            <span className="font-mono font-semibold">{String(log.action)}</span>
                            <span className="opacity-60">{String(log.adminUsername || "system")}</span>
                          </div>
                          <div dir="ltr" className="mt-1 text-[10px] opacity-60">
                            {String(log.targetType)} #{String(log.targetId || "-")} •{" "}
                            {String(log.createdAt).slice(0, 16).replace("T", " ")}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* ==================== MODALS ==================== */}
      {/* Ban Modal */}
      {banModalUser && (
        <ModalShell title={`حظر المستخدم: ${String(banModalUser.firstName)}`} onClose={() => setBanModalUser(null)}>
          <div className="space-y-4 text-xs">
            <label className="block space-y-1">
              <span>سبب الحظر (يُسجل في السجل التاريخي)</span>
              <input
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="مثال: إساءة استخدام نظام الإحالات"
                className="w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-white"
              />
            </label>
            <label className="block space-y-1">
              <span>مدة الحظر المؤقت (بالساعات)</span>
              <input
                type="number"
                min={1}
                value={banHours}
                onChange={(e) => setBanHours(Number(e.target.value))}
                className="w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-white"
              />
            </label>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={async () => {
                  const { ok, data } = await apiMutate("/api/admin/users", "POST", {
                    userId: Number(banModalUser.id),
                    action: "ban_temp",
                    reason: banReason || "مخالفة شروط الاستخدام",
                    durationHours: banHours,
                  });
                  if (ok) {
                    showToast(data.message);
                    setBanModalUser(null);
                    loadUsers();
                    loadOverview();
                  }
                }}
                className="flex-1 cursor-pointer rounded-xl bg-amber-600 py-2.5 font-semibold text-white"
              >
                حظر مؤقت ({banHours} ساعة)
              </button>
              <button
                type="button"
                onClick={async () => {
                  const { ok, data } = await apiMutate("/api/admin/users", "POST", {
                    userId: Number(banModalUser.id),
                    action: "ban_perm",
                    reason: banReason || "حظر دائم من الإدارة",
                  });
                  if (ok) {
                    showToast(data.message);
                    setBanModalUser(null);
                    loadUsers();
                    loadOverview();
                  }
                }}
                className="flex-1 cursor-pointer rounded-xl bg-red-600 py-2.5 font-semibold text-white"
              >
                حظر دائم
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* Ban History Modal */}
      {banHistoryModal && (
        <ModalShell title={`سجل الحظر التاريخي — ${banHistoryModal.name}`} onClose={() => setBanHistoryModal(null)}>
          <div className="max-h-72 space-y-2.5 overflow-y-auto text-xs">
            {banHistoryModal.rows.length === 0 ? (
              <p className="opacity-65">لا توجد سجلات حظر سابقة لهذا المستخدم.</p>
            ) : (
              banHistoryModal.rows.map((b) => (
                <div key={String(b.id)} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex justify-between font-semibold">
                    <span>{b.banType === "permanent" ? "حظر دائم" : "حظر مؤقت"}</span>
                    <span>{b.isActive ? "سارٍ" : "منتهٍ / مرفوع"}</span>
                  </div>
                  <p className="mt-1 opacity-80">السبب: {String(b.reason)}</p>
                  <p className="mt-1 text-[10px] opacity-60">
                    المنفّذ: {String(b.bannedByUsername || "owner")} | تاريخ الحظر:{" "}
                    {String(b.bannedAt).slice(0, 16).replace("T", " ")}
                    {b.unbannedAt ? ` | فك الحظر: ${String(b.unbannedAt).slice(0, 16).replace("T", " ")}` : ""}
                  </p>
                </div>
              ))
            )}
          </div>
        </ModalShell>
      )}

      {/* Edit Site Modal */}
      {editSiteModal && (
        <ModalShell title="تعديل إداري للموقع" onClose={() => setEditSiteModal(null)}>
          <div className="space-y-3 text-xs">
            <label className="block space-y-1">
              <span>عنوان الموقع</span>
              <input
                value={editSiteModal.title}
                onChange={(e) => setEditSiteModal({ ...editSiteModal, title: e.target.value })}
                className="w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-white"
              />
            </label>
            <label className="block space-y-1">
              <span>الرسالة الأساسية</span>
              <textarea
                rows={4}
                value={editSiteModal.mainMessage}
                onChange={(e) =>
                  setEditSiteModal({ ...editSiteModal, mainMessage: e.target.value })
                }
                className="w-full rounded-xl border border-white/15 bg-black/50 p-3 text-white"
              />
            </label>
            <button
              type="button"
              onClick={async () => {
                const { ok, data } = await apiMutate("/api/admin/sites", "PATCH", {
                  siteId: editSiteModal.id,
                  action: "edit",
                  title: editSiteModal.title,
                  mainMessage: editSiteModal.mainMessage,
                });
                if (ok) {
                  showToast(data.message);
                  setEditSiteModal(null);
                  loadSites();
                }
              }}
              className="w-full cursor-pointer rounded-xl bg-indigo-600 py-2.5 font-semibold text-white"
            >
              حفظ التعديلات
            </button>
          </div>
        </ModalShell>
      )}

      {/* Site Events Modal */}
      {siteEventsModal && (
        <ModalShell title={`سجل عمليات الموقع — ${siteEventsModal.title}`} onClose={() => setSiteEventsModal(null)}>
          <div className="max-h-72 space-y-2 overflow-y-auto text-xs">
            {siteEventsModal.rows.map((ev) => (
              <div key={String(ev.id)} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex justify-between font-mono">
                  <span>{String(ev.eventType)}</span>
                  <span className="opacity-60">{String(ev.actorType)}</span>
                </div>
                <p dir="ltr" className="mt-1 text-[10px] opacity-60">
                  {String(ev.createdAt).slice(0, 19).replace("T", " ")}
                </p>
              </div>
            ))}
          </div>
        </ModalShell>
      )}

      {/* New Template Modal */}
      {newTplModal && (
        <ModalShell title="تسجيل ونشر قالب جديد من GitHub" onClose={() => setNewTplModal(false)}>
          <div className="grid gap-3 text-xs sm:grid-cols-2">
            <label className="space-y-1">
              <span>التصنيف</span>
              <select
                value={newTplForm.categoryId}
                onChange={(e) => setNewTplForm({ ...newTplForm, categoryId: Number(e.target.value) })}
                className="w-full rounded-xl border border-white/15 bg-black/60 px-3 py-2 text-white"
              >
                {tplCats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameAr}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span>المعرّف (slug)</span>
              <input
                dir="ltr"
                value={newTplForm.slug}
                onChange={(e) => setNewTplForm({ ...newTplForm, slug: e.target.value })}
                placeholder="golden-memory-2026"
                className="w-full rounded-xl border border-white/15 bg-black/60 px-3 py-2 text-white"
              />
            </label>
            <label className="space-y-1">
              <span>الاسم بالعربية</span>
              <input
                value={newTplForm.nameAr}
                onChange={(e) => setNewTplForm({ ...newTplForm, nameAr: e.target.value })}
                className="w-full rounded-xl border border-white/15 bg-black/60 px-3 py-2 text-white"
              />
            </label>
            <label className="space-y-1">
              <span>الاسم بالإنجليزية</span>
              <input
                dir="ltr"
                value={newTplForm.nameEn}
                onChange={(e) => setNewTplForm({ ...newTplForm, nameEn: e.target.value })}
                className="w-full rounded-xl border border-white/15 bg-black/60 px-3 py-2 text-white"
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span>مسار القالب في GitHub</span>
              <input
                dir="ltr"
                value={newTplForm.githubPath}
                onChange={(e) => setNewTplForm({ ...newTplForm, githubPath: e.target.value })}
                className="w-full rounded-xl border border-white/15 bg-black/60 px-3 py-2 text-white"
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span>الوصف</span>
              <textarea
                rows={2}
                value={newTplForm.descriptionAr}
                onChange={(e) => setNewTplForm({ ...newTplForm, descriptionAr: e.target.value })}
                className="w-full rounded-xl border border-white/15 bg-black/60 p-2.5 text-white"
              />
            </label>
            <label className="space-y-1">
              <span>نوع التجربة التفاعلية</span>
              <select
                value={newTplForm.experienceType}
                onChange={(e) => setNewTplForm({ ...newTplForm, experienceType: e.target.value })}
                className="w-full rounded-xl border border-white/15 bg-black/60 px-3 py-2 text-white"
              >
                <option value="envelope-letter">مظروف مختوم</option>
                <option value="days-counter">عداد الأيام</option>
                <option value="countdown-unlock">قفل العد التنازلي</option>
                <option value="gift-box-reveal">صندوق هدية 3D</option>
                <option value="lucky-wheel">عجلة الحظ</option>
                <option value="interactive-quiz">أسئلة تفاعلية</option>
                <option value="celebration-rsvp">مناسبة ودعوة</option>
                <option value="portfolio-studio">معرض أعمال</option>
              </select>
            </label>
            <label className="space-y-1">
              <span>الفئة</span>
              <select
                value={newTplForm.tier}
                onChange={(e) =>
                  setNewTplForm({
                    ...newTplForm,
                    tier: e.target.value as "free" | "premium",
                  })
                }
                className="w-full rounded-xl border border-white/15 bg-black/60 px-3 py-2 text-white"
              >
                <option value="free">مجاني</option>
                <option value="premium">مميز</option>
              </select>
            </label>
            <button
              type="button"
              onClick={async () => {
                const { ok, data } = await apiMutate("/api/admin/templates", "POST", {
                  mode: "create",
                  ...newTplForm,
                  isPublished: true,
                });
                showToast(ok ? data.message : data.error);
                if (ok) {
                  setNewTplModal(false);
                  loadTemplates();
                  loadOverview();
                }
              }}
              className="mt-2 cursor-pointer rounded-xl bg-indigo-600 py-2.5 font-semibold text-white sm:col-span-2"
            >
              تسجيل ونشر القالب فوراً
            </button>
          </div>
        </ModalShell>
      )}

      {/* Template Version Release Modal */}
      {verModal && (
        <ModalShell title={`إصدار جديد — ${verModal.nameAr}`} onClose={() => setVerModal(null)}>
          <div className="space-y-3 text-xs">
            <p className="opacity-75">
              الإصدار الحالي: <code>v{verModal.currentVersion}</code> (ستظل المواقع القديمة مثبتة على
              إصدارها لضمان عدم تأثرها).
            </p>
            <label className="block space-y-1">
              <span>رقم الإصدار الجديد (Semantic Version)</span>
              <input
                dir="ltr"
                value={verModal.nextVersion}
                onChange={(e) => setVerModal({ ...verModal, nextVersion: e.target.value })}
                className="w-full rounded-xl border border-white/15 bg-black/60 px-3 py-2 text-white"
              />
            </label>
            <label className="block space-y-1">
              <span>ملخص التحديث</span>
              <input
                value={verModal.changelog}
                onChange={(e) => setVerModal({ ...verModal, changelog: e.target.value })}
                placeholder="تحسينات في الأداء والتوافق"
                className="w-full rounded-xl border border-white/15 bg-black/60 px-3 py-2 text-white"
              />
            </label>
            <button
              type="button"
              onClick={async () => {
                const { ok, data } = await apiMutate("/api/admin/templates", "PATCH", {
                  templateId: verModal.id,
                  newVersion: verModal.nextVersion,
                  changelog: verModal.changelog,
                });
                showToast(ok ? data.message : data.error);
                if (ok) {
                  setVerModal(null);
                  loadTemplates();
                }
              }}
              className="w-full cursor-pointer rounded-xl bg-indigo-600 py-2.5 font-semibold text-white"
            >
              نشر الإصدار المعتمد
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

function PaginationBar({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (next: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-2 text-xs">
      <span className="opacity-60">
        صفحة {page} من {totalPages}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="cursor-pointer rounded-lg border border-current/15 px-3 py-1 disabled:opacity-40"
        >
          السابق
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          className="cursor-pointer rounded-lg border border-current/15 px-3 py-1 disabled:opacity-40"
        >
          التالي
        </button>
      </div>
    </div>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-white/12 bg-zinc-900 p-6 text-zinc-100 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
          <h3 className="text-sm font-bold">{title}</h3>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="cursor-pointer">
            <X className="h-4 w-4 opacity-70 hover:opacity-100" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
