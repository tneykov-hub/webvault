Warning: truncated output (original token count: 32731)
Total output lines: 1836

"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent as ReactDragEvent, FormEvent, ReactNode } from "react";
import Link from "next/link";
import {
  BarChart3,
  Check,
  Crown,
  ChevronDown,
  ChevronUp,
  Clock3,
  Download,
  ExternalLink,
  FileJson,
  FolderPlus,
  Globe2,
  GripVertical,
  ImagePlus,
  KeyRound,
  LoaderCircle,
  LogOut,
  Moon,
  MoreHorizontal,
  Palette,
  Pencil,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Star,
  Smartphone,
  Sun,
  Trash2,
  Upload,
  UserCircle,
  X,
} from "lucide-react";
import { AuthGate, useWebVaultAuth } from "@/components/auth-gate";
import { UpgradeModal } from "@/components/upgrade-modal";
import { FREE_CATEGORY_LIMIT, FREE_SITE_LIMIT, freeSubscriptionProfile, type SubscriptionProfile } from "@/lib/plans";
import { supabase } from "@/lib/supabase";
import { isNativeApp, openInNativeBrowser, webVaultApiUrl } from "@/lib/native-app";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type Category = {
  id: string;
  name: string;
  icon: string;
  tone: string;
  position: number;
  isSystem: boolean;
};

type Site = {
  id: string;
  name: string;
  url: string;
  domain: string;
  description: string;
  categoryId: string | null;
  favorite: boolean;
  faviconUrl: string | null;
  customIconUrl: string | null;
  openInNewTab: boolean | null;
  position: number;
  visitCount: number;
  lastOpenedAt: string | null;
};

type SiteDraft = {
  name: string;
  url: string;
  categoryId: string;
  description: string;
  favorite: boolean;
  openInNewTab: boolean;
};

type BackupCategory = { name: string; icon: string; tone: string; position: number };
type BackupSite = {
  name: string;
  url: string;
  domain: string;
  description: string;
  categoryName: string;
  favorite: boolean;
  faviconUrl: string | null;
  customIconUrl: string | null;
  openInNewTab: boolean | null;
  position: number;
};
type ImportPreview = {
  fileName: string;
  source: "backup" | "chrome" | "sample";
  categories: BackupCategory[];
  sites: BackupSite[];
  invalidCount: number;
};
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
type DashboardLanguage = "en" | "bg";
type SearchFilter = "all" | "favorites" | "recent" | "visited";

const englishCopy: Record<string, string> = {
  "Всичко важно на едно място": "Everything important in one place",
  Профил: "Profile",
  "Смени цветния режим": "Toggle theme",
  "Backup и импорт": "Backup & import",
  "Инсталирай приложението": "Install app",
  "Управление на категории": "Manage categories",
  Изход: "Sign out",
  "Лично пространство": "Personal space",
  "Намери любимите си сайтове за секунди.": "Find your favourite sites in seconds.",
  Категории: "Categories",
  "Добави сайт": "Add site",
  "Търси по име, адрес или категория…": "Search by name, address or category…",
  "Търси сайтове": "Search sites",
  Изчисти: "Clear",
  "Зареждаме твоите сайтове…": "Loading your sites…",
  "Опитай отново": "Try again",
  Любими: "Favourites",
  "Добави първия си сайт": "Add your first site",
  "Добави първия сайт": "Add the first site",
  "Всички нови записи ще се пазят сигурно и ще се синхронизират между устройствата ти.": "New entries are stored securely and synced across your devices.",
  "Добре дошъл в WebVault": "Welcome to WebVault",
  "Пренеси отметките си, разгледай примерна колекция или започни от нулата.": "Bring your bookmarks, explore a sample collection, or start from scratch.",
  "Качи HTML файл с отметки и запази папките.": "Upload a bookmarks HTML file and keep its folders.",
  "Опитай примерна колекция": "Try a sample collection",
  "Прегледай подредено табло, преди да добавиш своите сайтове.": "Explore an organised dashboard before adding your own sites.",
  "Започни от нулата": "Start from scratch",
  "Добави първия си сайт ръчно.": "Add your first site manually.",
  "Данните ти са твои — можеш да ги експортираш по всяко време.": "Your data is yours — export it whenever you want.",
  "Синхронизацията е активна на всички твои устройства.": "Sync is active across all your devices.",
  "Записите се пазят в личния ти акаунт. PRO ги синхронизира на всички устройства.": "Your bookmarks are stored in your private account. PRO keeps them synced across all devices.",
  "Няма намерени сайтове": "No sites found",
  "Опитай с друго име, адрес или категория.": "Try another name, address or category.",
  сайт: "site",
  сайта: "sites",
  "запазени сайта": "saved sites",
  категории: "categories",
  "Редактирай сайт": "Edit site",
  "Добави нов сайт": "Add a new site",
  "Промените и иконата ще се обновят веднага.": "Your changes and icon will update immediately.",
  "Иконата на сайта ще се добави автоматично, когато е налична.": "The icon and metadata will be detected automatically when available.",
  Име: "Title",
  Адрес: "URL",
  Категория: "Category",
  "Избери категория": "Choose a category",
  Описание: "Description",
  "по желание": "optional",
  "Кратко описание": "Short description",
  "Напр. YouTube": "e.g. YouTube",
  "Отвори менюто Share в Safari и избери „Add to Home Screen“.": "Open the Share menu in Safari and choose ‘Add to Home Screen’.",
  "Отвори менюто на Chrome и избери „Install app“ или „Добавяне към началния екран“.": "Open the Chrome menu and choose ‘Install app’.",
  "Да изтрия ли категорията?": "Delete this category?",
  "Да изтрия ли сайта?": "Delete this site?",
  "Категорията ще бъде премахната. Сайтовете в нея няма да се загубят — ще бъдат преместени в „Други“.": "The category will be removed. Its sites will be moved to Other.",
  "Това действие ще премахне сайта от твоя списък окончателно.": "This will permanently remove the site from your list.",
  "Изтрий категорията": "Delete category",
  "Отваряне на сайта": "Open site",
  "В нов таб": "In a new tab",
  "WebVault остава отворен": "WebVault stays open",
  "В същия таб": "In the same tab",
  "Заменя текущата страница": "Replace the current page",
  "В мобилното приложение сайтовете се отварят в защитен браузър, докато WebVault остава отворен.": "In the mobile app, sites open in a secure browser while WebVault stays open.",
  "Собствена икона": "Custom icon",
  "PNG, JPG, WebP или GIF · до 2 MB": "PNG, JPG, WebP or GIF · up to 2 MB",
  Смени: "Replace",
  Избери: "Choose",
  Премахни: "Remove",
  Отказ: "Cancel",
  "Запази промените": "Save changes",
  "Всички промени се запазват и синхронизират веднага. Можеш и да ги влачиш.": "Changes save and sync instantly. You can also drag to reorder.",
  Икона: "Icon",
  "Име на категория": "Category name",
  "Премести нагоре": "Move up",
  "Премести надолу": "Move down",
  "Изтрий категория": "Delete category",
  "Категория Други е необходима": "The Other category is required",
  "Нова категория": "New category",
  "Нова икона": "New icon",
  "Име на категорията": "Category name",
  Добави: "Add",
  Готово: "Done",
  "Backup и Import": "Backup & Import",
  "Запази личното си копие или добави записи от WebVault и Chrome.": "Save a personal copy or add entries from WebVault and Chrome.",
  "Експорт на всички данни": "Export all data",
  "Сваля JSON файл с категориите, сайтовете, реда и любимите.": "Download a JSON file with categories, sites, ordering and favourites.",
  "Свали backup": "Download backup",
  "HTML export за браузър": "Browser HTML export",
  "Сваля стандартен HTML файл за Chrome, Edge, Firefox и други браузъри.": "Download a standard HTML file for Chrome, Edge, Firefox and other browsers.",
  "Свали HTML": "Download HTML",
  "Импорт от WebVault": "Import from WebVault",
  "Добавя липсващите записи от WebVault без да презаписва текущите.": "Add missing WebVault entries without overwriting current ones.",
  "Избери JSON": "Choose JSON",
  "Импорт от Chrome": "Import from Chrome",
  "Импортира папките като категории и запазва подредбата на отметките.": "Import folders as categories and preserve bookmark order.",
  "Избери HTML": "Choose HTML",
  "Примерна колекция": "Sample collection",
  "Добавя шест примерни отметки, които можеш да редактираш или изтриеш.": "Add six sample bookmarks that you can edit or delete.",
  "Прегледай примера": "Preview sample",
  "FREE: импорт до 30 сайта в наличните 3 категории. Останалите папки се поставят в „Други“.": "FREE: import up to 30 sites into the 3 available categories. Extra folders are placed in Other.",
  "PRO: неограничен импорт и синхронизация на всички устройства.": "PRO: unlimited import and sync across all devices.",
  "Добави данните": "Add data",
  "Импортваме…": "Importing…",
  "Невалидните записи ще бъдат пропуснати": "invalid entries will be skipped",
  Затвори: "Close",
  "Инсталирай WebVault": "Install WebVault",
  "Отваряй приложението от началния екран като самостоятелно приложение.": "Open the app from your home screen as a standalone app.",
  "WebVault вече е инсталиран": "WebVault is already installed",
  "Можеш да го отваряш директно от началния екран или менюто с приложения.": "You can open it from your home screen or app menu.",
  "Готово за инсталиране": "Ready to install",
  "Натисни бутона и потвърди инсталирането в браузъра.": "Press the button and confirm installation in the browser.",
  "iPhone / iPad": "iPhone / iPad",
  "Android / Windows": "Android / Windows",
  "Да изтрия ли": "Delete",
  "Изтрий сайта": "Delete site",
  Преименувай: "Rename",
  "Действия за": "Actions for",
  "Преглед на собствената икона": "Custom icon preview",
  Възстановяване: "Recovery",
  "Нова парола": "New password",
  "Профил и настройки": "Profile & settings",
  Език: "Language",
  Тема: "Theme",
  Светла: "Light",
  Тъмна: "Dark",
  Имейл: "Email",
  "Този имейл е свързан с акаунта ти.": "This email is linked to your account.",
  "Смени паролата": "Change password",
  "Въведи нова парола": "Enter a new password",
  "Потвърди новата парола": "Confirm new password",
  "Паролата трябва да е поне 8 символа.": "Password must be at least 8 characters.",
  "Паролите не съвпадат.": "Passwords do not match.",
  "Паролата е обновена.": "Password updated.",
  "Запази паролата": "Save password",
  "Профилът ти": "Your profile",
  "Излез от акаунта": "Sign out of account",
  Скорошни: "Recent",
  "Най-посещавани": "Most visited",
  Всички: "All",
};

const extraEnglishCopy: Record<string, string> = {
  Изтрий: "Delete",
  "Добави или премахни от любими": "Favorite",
  "Влачи, за да преместиш": "Drag to move",
  "Тази категория все още е празна": "This category is still empty",
  "Пусни сайта тук": "Drop the site here",
  Настройки: "Settings",
  "Изтегли backup": "Download backup",
  "Мобилен изглед": "Mobile view",
  "Отвори настройките": "Open settings",
  "Промени иконата": "Change icon",
  "Промени цвета": "Change color",
  "Свий всички": "Collapse all",
  "Разгъни категорията": "Expand category",
  "Свий категорията": "Collapse category",
  "Външна връзка": "Open external link",
  "Импорт на отметки": "Import bookmarks",
  "Сайтът е добавен": "Site added",
  "Сайтът е обновен": "Site updated",
  "Сайтовете са импортнати": "Sites imported",
  "Metadata се зарежда…": "Fetching metadata…",
  "Натисни K за търсене": "Press K to search",
  "Създай нова категория": "Create new category",
  "Добави категория": "Add category",
  "Стани PRO": "Go Pro",
  "PRO е активен": "PRO active",
  "Тази функция е налична с PRO.": "This feature is available with PRO.",
  "Име в профила": "Display name",
  "Това име се вижда в поздрава и аватара.": "This name appears in your greeting and avatar.",
  "Въведи име за профила": "Enter your display name",
  "Името трябва да е поне 2 символа.": "Your name must be at least 2 characters.",
  "Името е запазено.": "Name saved.",
  "Запази името": "Save name",
  "Връзката с профила не е налична.": "The profile connection is not available.",
  "Изтриване на акаунта": "Account deletion",
  "Изтриваш окончателно профила, отметките, категориите, устройства и качените икони. Ако имаш активен абонамент през Stripe, той ще бъде отменен.": "This permanently deletes your profile, bookmarks, categories, registered devices, and uploaded icons. An active Stripe subscription will be cancelled.",
  "Политика и помощ": "Privacy policy & help",
  "Изтрий акаунта": "Delete account",
  "Да изтрия ли акаунта?": "Delete your account?",
  "Това действие е окончателно. Ще изтрием твоите WebVault данни. Активен абонамент през Stripe ще бъде отменен веднага.": "This is permanent. Your WebVault data will be deleted. An active Stripe subscription will be cancelled immediately.",
  "Сесията е изтекла. Влез отново, преди да изтриеш акаунта.": "Your session has expired. Sign in again before deleting your account.",
  "Не успяхме да изтрием акаунта. Опитай отново или използвай страницата за изтриване.": "We could not delete the account. Try again or use the account-deletion page.",
};

const englishCategoryNames: Record<string, string> = {
  Футбол: "Football",
  Имейл: "Email",
  Работа: "Work",
  Новини: "News",
  Пазаруване: "Shopping",
  Медия: "Media",
  Обучение: "Learning",
  Други: "Other",
};

function categoryDisplayName(name: string, language: DashboardLanguage) {
  return language === "en" ? englishCategoryNames[name] ?? name : name;
}

function fallbackDisplayName(user: { email?: string | null; user_metadata?: Record<string, unknown> | null }) {
  const metadata = user.user_metadata ?? {};
  const metadataName = [metadata.full_name, metadata.name]
    .find((value): value is string => typeof value === "string" && value.trim().length > 0)
    ?.trim();
  if (metadataName) return metadataName;
  return user.email?.split("@")[0]?.trim() || "WebVault user";
}

function avatarInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "WV";
  if (words.length === 1) return Array.from(words[0]).slice(0, 2).join("").toLocaleUpperCase();
  return [words[0], words[words.length - 1]].map((word) => Array.from(word)[0] ?? "").join("").toLocaleUpperCase();
}

const LanguageContext = createContext<{
  language: DashboardLanguage;
  setLanguage: (language: DashboardLanguage) => void;
  t: (value: string) => string;
}>({ language: "en", setLanguage: () => undefined, t: (value) => value });

function useDashboardLanguage() {
  return useContext(LanguageContext);
}

function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<DashboardLanguage>(() => {
    try {
      return window.localStorage.getItem("webvault-language") === "bg" ? "bg" : "en";
    } catch {
      return "en";
    }
  });

  const setLanguage = (next: DashboardLanguage) => {
    setLanguageState(next);
    try {
      window.localStorage.setItem("webvault-language", next);
    } catch {
      // Local storage can be unavailable in private browser modes.
    }
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t: (text: string) => (language === "en" ? englishCopy[text] ?? extraEnglishCopy[text] ?? text : text),
    }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

const emptySiteDraft: SiteDraft = {
  name: "",
  url: "",
  categoryId: "",
  description: "",
  favorite: false,
  openInNewTab: true,
};
const displayStorageKey = "my-sites-display-preferences";
const collapsedStorageKey = "webvault-collapsed-categories";
const palette = ["#16a9c7", "#6754d8", "#d87757", "#138a91", "#e14d3d", "#28a773", "#f48120", "#34445c"];
const toneOrder = ["aqua", "violet", "amber", "blue", "rose", "green"];
const allowedTones = new Set(toneOrder);
const iconMimeExtensions: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

function byPosition(first: Site, second: Site) {
  return first.position - second.position || first.name.localeCompare(second.name, "bg");
}

function displayColor(seed: string) {
  return palette[[...seed].reduce((total, character) => total + character.charCodeAt(0), 0) % palette.length];
}

function glyphFor(site: Site) {
  const words = site.name.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]).join("").toLocaleUpperCase("bg") || "↗";
}

function faviconFor(url: string) {
  try {
    const parsed = new URL(url);
    return `https://www.google.com/s2/favicons?sz=128&domain_url=${encodeURIComponent(parsed.origin)}`;
  } catch {
    return null;
  }
}

function cleanHttpUrl(value: string) {
  const candidate = /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return { url: parsed.href, domain: parsed.hostname.replace(/^www\./i, "") };
  } catch {
    return null;
  }
}

function cleanDescription(value: unknown) {
  const description = typeof value === "string" ? value.trim() : "";
  if (!description || /^(?:no\s+description|без\s+описание)$/i.test(description)) return "";
  return description.slice(0, 500);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizedName(value: string) {
  return value.trim().toLocaleLowerCase("bg");
}

function escapeBookmarkHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function downloadTextFile(contents: string, fileName: string, type: string) {
  const blobUrl = URL.createObjectURL(new Blob([contents], { type }));
  const download = document.createElement("a");
  download.href = blobUrl;
  download.download = fileName;
  document.body.appendChild(download);
  download.click();
  download.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
}

function sampleCollection(): ImportPreview {
  const categories: BackupCategory[] = [
    { name: "Футбол", icon: "⚽", tone: "aqua", position: 100 },
    { name: "AI", icon: "✦", tone: "violet", position: 200 },
    { name: "Други", icon: "⭐", tone: "amber", position: 300 },
  ];
  const entries = [
    { name: "UEFA Champions League", url: "https://www.uefa.com/uefachampionsleague/", categoryName: "Футбол", description: "Official fixtures, results and news." },
    { name: "BBC Sport Football", url: "https://www.bbc.com/sport/football", categoryName: "Футбол", description: "Football news, scores and analysis." },
    { name: "ChatGPT", url: "https://chatgpt.com/", categoryName: "AI", description: "AI assistant for writing, research and ideas." },
    { name: "Perplexity", url: "https://www.perplexity.ai/", categoryName: "AI", description: "AI-powered web research." },
    { name: "GitHub", url: "https://github.com/", categoryName: "Други", description: "Code, projects and collaboration." },
    { name: "Wikipedia", url: "https://www.wikipedia.org/", categoryName: "Други", description: "The free encyclopaedia." },
  ];
  const sites = entries.flatMap<BackupSite>((entry, index) => {
    const details = cleanHttpUrl(entry.url);
    if (!details) return [];
    return [{
      ...entry,
      url: details.url,
      domain: details.domain,
      favorite: index === 2 || index === 4,
      faviconUrl: faviconFor(details.url),
      customIconUrl: null,
      openInNewTab: true,
      position: (index + 1) * 100,
    }];
  });
  return { fileName: "WebVault starter", source: "sample", categories, sites, invalidCount: 0 };
}

function asCategory(row: Record<string, unknown>): Category {
  return {
    id: String(row.id),
    name: String(row.name),
    icon: String(row.icon ?? "🔖"),
    tone: String(row.tone ?? "blue"),
    position: Number(row.position ?? 0),
    isSystem: Boolean(row.is_system),
  };
}

function asSite(row: Record<string, unknown>): Site {
  return {
    id: String(row.id),
    name: String(row.name),
    url: String(row.url),
    domain: String(row.domain),
    description: cleanDescription(row.description),
    categoryId: row.category_id ? String(row.category_id) : null,
    favorite: Boolean(row.is_favorite),
    faviconUrl: row.favicon_url ? String(row.favicon_url) : null,
    customIconUrl: row.custom_icon_url ? String(row.custom_icon_url) : null,
    openInNewTab: typeof row.open_in_new_tab === "boolean" ? row.open_in_new_tab : null,
    position: Number(row.position ?? 0),
    visitCount: Number(row.visit_count ?? 0),
    lastOpenedAt: row.last_opened_at ? String(row.last_opened_at) : null,
  };
}

function asSubscriptionProfile(row: Record<string, unknown> | null): SubscriptionProfile {
  if (!row) return freeSubscriptionProfile;
  return {
    isPro: row.is_pro === true,
    stripeCustomerId: typeof row.stripe_customer_id === "string" ? row.stripe_customer_id : null,
    stripeSubscriptionId: typeof row.stripe_subscription_id === "string" ? row.stripe_subscription_id : null,
    subscriptionStatus: typeof row.stripe_subscription_status === "string" ? row.stripe_subscription_status : null,
  };
}

function suggestedCategoryId(categories: Category[], url: string) {
  const details = cleanHttpUrl(url);
  if (!details) return null;
  const haystack = `${details.domain} ${details.url}`.toLocaleLowerCase("bg");
  const wanted = /sport|football|soccer|fifa|uefa|gong\.bg|fotmob|transfermarkt/.test(haystack)
    ? /футбол|football|sport|спорт/i
    : /\bai\b|chat|gemini|openai|claude|copilot|perplexity/.test(haystack)
      ? /\bai\b|изкуствен|интелект|чат|технолог/i
      : null;
  if (!wanted) return null;
  return categories.find((category) => wanted.test(category.name))?.id ?? null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default function Home() {
  return <AuthGate><LanguageProvider><Dashboard /></LanguageProvider></AuthGate>;
}

function Dashboard() {
  const { session, signOut } = useWebVaultAuth();
  const { language, setLanguage, t } = useDashboardLanguage();
  const [profileDisplayName, setProfileDisplayName] = useState("");
  const [query, setQuery] = useState("");
  const [searchFilter, setSearchFilter] = useState<SearchFilter>("all");
  const [dark, setDark] = useState(false);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [siteItems, setSiteItems] = useState<Site[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionProfile>(freeSubscriptionProfile);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState("");
  const [dataReady, setDataReady] = useState(false);
  const [dataError, setDataError] = useState("");
  const [showSiteDialog, setShowSiteDialog] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [siteDraft, setSiteDraft] = useState<SiteDraft>(emptySiteDraft);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [siteError, setSiteError] = useState("");
  const [siteBusy, setSiteBusy] = useState(false);
  const [metadataBusy, setMetadataBusy] = useState(false);
  const [detectedFavicon, setDetectedFavicon] = useState<string | null>(null);
  const [showInlineCategoryCreate, setShowInlineCategoryCreate] = useState(false);
  const [inlineCategoryName, setInlineCategoryName] = useState("");
  const [siteIconFile, setSiteIconFile] = useState<File | null>(null);
  const [siteIconPreview, setSiteIconPreview] = useState<string | null>(null);
  const [removeCustomIcon, setRemoveCustomIcon] = useState(false);
  const siteIconInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const titleTouchedRef = useRef(false);
  const descriptionTouchedRef = useRef(false);
  const categoryTouchedRef = useRef(false);
  const metadataFetchedForRef = useRef("");
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, string>>({});
  const [categoryIconDrafts, setCategoryIconDrafts] = useState<Record<string, string>>({});
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryIcon, setNewCategoryIcon] = useState("🔖");
  const [categoryError, setCategoryError] = useState("");
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<Category | null>(null);
  const [deleteSiteTarget, setDeleteSiteTarget] = useState<Site | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [showBackupDialog, setShowBackupDialog] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const chromeInputRef = useRef<HTMLInputElement>(null);
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(() => isNativeApp() || (typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true))));
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null);
  const [draggedSiteId, setDraggedSiteId] = useState<string | null>(null);
  const [dropTargetSiteId, setDropTargetSiteId] = useState<string | null>(null);
  const [siteOrderBusy, setSiteOrderBusy] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [newlyAddedSiteId, setNewlyAddedSiteId] = useState<string | null>(null);
  const toastTimerRef = useRef<number | undefined>(undefined);
  const displayName = profileDisplayName || fallbackDisplayName(session.user);
  const nativeApp = isNativeApp();

  async function saveDisplayName(nextName: string) {
    if (!supabase) return t("Връзката с профила не е налична.");
    const result = await supabase.from("profiles").update({ display_name: nextName }).eq("id", session.user.id);
    if (result.error) return result.error.message;
    setProfileDisplayName(nextName);
    return null;
  }

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(displayStorageKey);
      const parsed = saved ? (JSON.parse(saved) as { dark?: boolean; collapsedCategories?: Record<string, boolean> }) : null;
      if (parsed) {
        // This one-time hydration reads a browser preference into React state.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDark(parsed.dark === true);
        if (parsed.collapsedCategories) setCollapsedCategories(parsed.collapsedCategories);
      } else {
        setDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
      }
      const collapsed = window.localStorage.getItem(collapsedStorageKey);
      if (collapsed) setCollapsedCategories(JSON.parse(collapsed) as Record<string, boolean>);
    } catch {
      setDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
    }
    setPreferencesReady(true);
  }, []);

  useEffect(() => {
    if (!preferencesReady) return;
    const value = JSON.stringify({ dark, collapsedCategories });
    window.localStorage.setItem(displayStorageKey, value);
    window.localStorage.setItem(collapsedStorageKey, JSON.stringify(collapsedCategories));
  }, [dark, collapsedCategories, preferencesReady]);

  useEffect(() => {
    document.documentElement.classList.toggle("site-dark", dark);
    return () => document.documentElement.classList.remove("site-dark");
  }, [dark]);

  useEffect(() => {
    if (isNativeApp()) return;
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js");
    const captureInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const markInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    window.addEventListener("appinstalled", markInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  useEffect(() => {
    const handleShortcut = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  function announceToast(message: string) {
    setToastMessage(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMessage(""), 2600);
  }

  async function loadData(background = false) {
    if (!supabase) return;
    const client = supabase;
    if (!background) {
      setDataReady(false);
      setDataError("");
    }
    const [categoriesResult, sitesResult, profileResult] = await Promise.all([
      client.from("categories").select("id,name,icon,tone,position,is_system").order("position").order("created_at"),
      client.from("sites").select("id,name,url,domain,description,favicon_url,custom_icon_url,is_favorite,position,open_in_new_tab,category_id,visit_count,last_opened_at").order("position").order("created_at"),
      client.from("profiles").select("display_name,is_pro,stripe_customer_id,stripe_subscription_id,stripe_subscription_status").eq("id", session.user.id).maybeSingle(),
    ]);
    if (categoriesResult.error || sitesResult.error || profileResult.error) {
      if (!background) {
        setDataError("Не успяхме да заредим записите ти. Обнови страницата и опитай отново.");
        setDataReady(true);
      }
      return;
    }
    setCategories((categoriesResult.data ?? []).map((row) => asCategory(row as Record<string, unknown>)));
    const profile = profileResult.data as Record<string, unknown> | null;
    setProfileDisplayName(typeof profile?.display_name === "string" ? profile.display_name.trim() : "");
    setSubscription(asSubscriptionProfile(profile));
    const loadedSites = (sitesResult.data ?? []).map((row) => asSite(row as Record<string, unknown>));
    const sitesWithFavicons = loadedSites.map((site) => site.customIconUrl || site.faviconUrl ? site : { ...site, faviconUrl: faviconFor(site.url) });
    setSiteItems(sitesWithFavicons);
    setDataReady(true);
    const missingFavicons = loadedSites.filter((site) => !site.customIconUrl && !site.faviconUrl);
    if (missingFavicons.length) void Promise.all(missingFavicons.map((site) => client.from("sites").update({ favicon_url: faviconFor(site.url) }).eq("id", site.id)));
  }

  useEffect(() => {
    // Loading remote data is the external-system synchronization for this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [session.user.id]);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let refreshTimer: number | undefined;
    const scheduleRefresh = () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void loadData(true), 350);
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") scheduleRefresh();
    };
    const channel = client.channel(`my-sites-sync-${session.user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `id=eq.${session.user.id}` }, scheduleRefresh);
    if (subscription.isPro) {
      channel
        .on("postgres_changes", { event: "*", schema: "public", table: "sites", filter: `user_id=eq.${session.user.id}` }, scheduleRefresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "categories", filter: `user_id=eq.${session.user.id}` }, scheduleRefresh);
    }
    channel.subscribe();
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    const poll = window.setInterval(refreshWhenVisible, 30_000);
    return () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      window.clearInterval(poll);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      void client.removeChannel(channel);
    };
  }, [session.user.id, subscription.isPro]);

  const categoryNames = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);
  const categoryLabels = useMemo(() => new Map(categories.map((category) => [category.id, categoryDisplayName(category.name, language)])), [categories, language]);
  const normalizedQuery = query.trim().toLocaleLowerCase("bg");
  const filteredSites = useMemo(() => {
    const matchingSites = siteItems.filter((site) => {
      const categoryName = categoryNames.get(site.categoryId ?? "") ?? "";
      const categoryLabel = categoryLabels.get(site.categoryId ?? "") ?? categoryName;
      const matchesQuery = !normalizedQuery || `${site.name} ${site.domain} ${site.description} ${categoryName} ${categoryLabel}`.toLocaleLowerCase("bg").includes(normalizedQuery);
      if (!matchesQuery) return false;
      if (searchFilter === "favorites") return site.favorite;
      if (searchFilter === "recent") return Boolean(site.lastOpenedAt);
      if (searchFilter === "visited") return site.visitCount > 0;
      return true;
    });
    return [...matchingSites].sort((first, second) => {
      if (searchFilter === "visited") return second.visitCount - first.visitCount || byPosition(first, second);
      if (searchFilter === "recent") return new Date(second.lastOpenedAt ?? 0).getTime() - new Date(first.lastOpenedAt ?? 0).getTime() || byPosition(first, second);
      return byPosition(first, second);
    });
  }, [categoryLabels, categoryNames, normalizedQuery, searchFilter, siteItems]);
  const groups = useMemo(() => categories.map((category) => ({ category, items: filteredSites.filter((site) => site.categoryId === category.id) })).filter(({ category, items }) => {
    const categoryLabel = categoryLabels.get(category.id) ?? category.name;
    return !normalizedQuery || items.length > 0 || `${category.name} ${categoryLabel}`.toLocaleLowerCase("bg").includes(normalizedQuery);
  }), [categories, categoryLabels, filteredSites, normalizedQuery]);
  const favoriteSites = filteredSites.filter((site) => site.favorite);
  const searchResultGroups = groups.filter(({ items }) => items.length > 0);

  function openCategoryManager() {
    setCategoryDrafts(Object.fromEntries(categories.map((category) => [category.id, categoryDisplayName(category.name, language)])));
    setCategoryIconDrafts(Object.fromEntries(categories.map((category) => [category.id, category.icon])));
    setCategoryError("");
    setShowCategories(true);
  }

  funct…12731 tokens truncated…           <input value={siteDraft.url} onChange={(event) => { setSiteDraft((draft) => ({ ...draft, url: event.target.value })); metadataFetchedForRef.current = ""; }} onBlur={() => void fetchMetadataForUrl(siteDraft.url)} onPaste={(event) => { const pastedValue = event.clipboardData.getData("text"); window.setTimeout(() => void fetchMetadataForUrl(pastedValue), 0); }} placeholder="https://youtube.com" inputMode="url" required />
            </label>
            <label>{t("Име")}
              <input value={siteDraft.name} onChange={(event) => { titleTouchedRef.current = true; setSiteDraft((draft) => ({ ...draft, name: event.target.value })); }} placeholder={t("Напр. YouTube")} maxLength={120} autoFocus required />
            </label>
            {metadataBusy && <p className="metadata-status"><LoaderCircle size={14} className="spin" /> {t("Metadata се зарежда…")}</p>}
            <div className="form-row">
              <label>{t("Категория")}
                <select value={showInlineCategoryCreate ? "__new__" : siteDraft.categoryId} onChange={(event) => handleCategorySelection(event.target.value)} required>
                  <option value="" disabled>{t("Избери категория")}</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.icon} {categoryLabels.get(category.id) ?? category.name}</option>)}
                  <option value="__new__">＋ {t("Създай нова категория")}</option>
                </select>
              </label>
              <label>{t("Описание")} <small>{t("по желание")}</small>
                <input value={siteDraft.description} onChange={(event) => { descriptionTouchedRef.current = true; setSiteDraft((draft) => ({ ...draft, description: event.target.value })); }} placeholder={t("Кратко описание")} maxLength={500} />
              </label>
            </div>
            {showInlineCategoryCreate && <div className="inline-category-create">
              <input value={inlineCategoryName} onChange={(event) => setInlineCategoryName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void createInlineCategory(); } }} placeholder={t("Име на категорията")} autoFocus />
              <button type="button" className="category-button" onClick={() => void createInlineCategory()}><Plus size={15} />{t("Добави категория")}</button>
            </div>}
            <label className="favorite-check"><input type="checkbox" checked={siteDraft.favorite} onChange={(event) => setSiteDraft((draft) => ({ ...draft, favorite: event.target.checked }))} /><span><Star size={16} /> {t("Любими")}</span></label>
            {nativeApp ? <p className="native-link-note">{t("В мобилното приложение сайтовете се отварят в защитен браузър, докато WebVault остава отворен.")}</p> : <fieldset className="link-target-field">
              <legend>{t("Отваряне на сайта")}</legend>
              <RadioGroup className="link-target-options" value={siteDraft.openInNewTab ? "new" : "same"} onValueChange={(value) => setSiteDraft((draft) => ({ ...draft, openInNewTab: value === "new" }))}>
                <label className="target-option"><RadioGroupItem value="new" /><span><strong>{t("В нов таб")}</strong><small>{t("WebVault остава отворен")}</small></span></label>
                <label className="target-option"><RadioGroupItem value="same" /><span><strong>{t("В същия таб")}</strong><small>{t("Заменя текущата страница")}</small></span></label>
              </RadioGroup>
            </fieldset>}
            <div className="icon-picker">
              <span className="icon-picker-preview">{siteIconPreview || detectedFavicon ? <img src={siteIconPreview ?? detectedFavicon ?? ""} alt={t("Преглед на собствената икона")} /> : <ImagePlus size={22} />}</span>
              <div>
                <strong>{t("Собствена икона")} <small>{t("по желание")}</small></strong>
                <p>{t("PNG, JPG, WebP или GIF · до 2 MB")}</p>
                <div className="icon-picker-actions">
                  <input ref={siteIconInputRef} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => { const file = event.target.files?.[0]; if (file) selectSiteIcon(file); }} />
                  <button type="button" className="category-button" onClick={() => siteIconInputRef.current?.click()}><ImagePlus size={16} />{siteIconPreview ? t("Смени") : t("Избери")}</button>
                  {siteIconPreview && <button type="button" className="text-button danger-item" onClick={clearCustomIcon}>{t("Премахни")}</button>}
                </div>
              </div>
            </div>
            <button type="button" className="import-bookmarks-button" onClick={importBookmarksFromSiteModal}><Upload size={16} />{t("Импорт на отметки")}</button>
            {siteError && <p className="form-error">{siteError}</p>}
            <div className="modal-actions">
              <button type="button" className="cancel" onClick={closeSiteDialog}>{t("Отказ")}</button>
              <button className="add-button" disabled={siteBusy}>{siteBusy ? <LoaderCircle size={18} className="spin" /> : editingSite ? <Pencil size={17} /> : <Plus size={18} />}{editingSite ? t("Запази промените") : t("Добави сайт")}</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={showCategories} onOpenChange={setShowCategories}><DialogContent className="dialog-panel category-dialog"><DialogHeader className="dialog-heading"><span className="modal-icon"><FolderPlus size={20} /></span><div><DialogTitle>{t("Управление на категории")}</DialogTitle><DialogDescription>{t("Всички промени се запазват и синхронизират веднага. Можеш и да ги влачиш.")}</DialogDescription></div></DialogHeader><div className="category-list">{categories.map((category, index) => <div className={`category-row ${draggedCategory === category.id ? "dragging" : ""}`} key={category.id} draggable={!categoryBusy} onDragStart={(event) => startCategoryDrag(event, category.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => dropCategory(category.id)} onDragEnd={() => setDraggedCategory(null)}><GripVertical className="drag-handle" size={18} /><input className="emoji-input" aria-label={t("Икона")} value={categoryIconDrafts[category.id] ?? category.icon} onChange={(event) => setCategoryIconDrafts((drafts) => ({ ...drafts, [category.id]: event.target.value }))} onBlur={() => void commitCategory(category.id)} maxLength={4} /><input className="category-name-input" aria-label={t("Име на категория")} value={categoryDrafts[category.id] ?? categoryDisplayName(category.name, language)} onChange={(event) => setCategoryDrafts((drafts) => ({ ...drafts, [category.id]: event.target.value }))} onBlur={() => void commitCategory(category.id)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} maxLength={64} /><div className="row-actions"><button onClick={() => moveCategory(category.id, -1)} disabled={categoryBusy || index === 0} aria-label={t("Премести нагоре")}><ChevronUp size={17} /></button><button onClick={() => moveCategory(category.id, 1)} disabled={categoryBusy || index === categories.length - 1} aria-label={t("Премести надолу")}><ChevronDown size={17} /></button><button className="trash-button" onClick={() => setDeleteCategoryTarget(category)} disabled={categoryBusy || category.isSystem} title={category.isSystem ? t("Категория Други е необходима") : t("Изтрий категория")} aria-label={t("Изтрий категория")}><Trash2 size={16} /></button></div></div>)}</div><div className="new-category"><h3><Plus size={17} /> {t("Нова категория")}</h3><div><input className="emoji-input" aria-label={t("Нова икона")} value={newCategoryIcon} onChange={(event) => setNewCategoryIcon(event.target.value)} maxLength={4} /><input placeholder={t("Име на категорията")} value={newCategoryName} onChange={(event) => { setNewCategoryName(event.target.value); setCategoryError(""); }} onKeyDown={(event) => { if (event.key === "Enter") void addCategory(); }} maxLength={64} /><button className="add-button" onClick={() => void addCategory()} disabled={categoryBusy}>{categoryBusy ? <LoaderCircle size={18} className="spin" /> : <Plus size={18} />}<b>{t("Добави")}</b></button></div>{categoryError && <p className="form-error">{categoryError}</p>}</div><div className="modal-actions"><button className="add-button" onClick={() => setShowCategories(false)}>{t("Готово")}</button></div></DialogContent></Dialog>
      <Dialog open={showBackupDialog} onOpenChange={setShowBackupDialog}>
        <DialogContent className="dialog-panel backup-dialog">
          <DialogHeader className="dialog-heading">
            <span className="modal-icon"><FileJson size={20} /></span>
            <div><DialogTitle>{t("Backup и Import")}</DialogTitle><DialogDescription>{t("Запази личното си копие или добави записи от WebVault и Chrome.")}</DialogDescription></div>
          </DialogHeader>
          <div className="backup-stack">
            <input ref={importInputRef} className="sr-only" type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void prepareImport(file); }} />
            <input ref={chromeInputRef} className="sr-only" type="file" accept="text/html,.html" onChange={(event) => { const file = event.target.files?.[0]; if (file) void prepareChromeImport(file); }} />
            <div className={`backup-plan-note ${subscription.isPro ? "pro" : ""}`}><Check size={16} /><span>{t(subscription.isPro ? "PRO: неограничен импорт и синхронизация на всички устройства." : "FREE: импорт до 30 сайта в наличните 3 категории. Останалите папки се поставят в „Други“.")}</span></div>
            <section className="backup-card">
              <div><strong>{t("Експорт на всички данни")}</strong><p>{t("Сваля JSON файл с категориите, сайтовете, реда и любимите.")}</p></div>
              <button className="category-button" onClick={exportBackup}><Download size={17} />{t("Свали backup")}</button>
            </section>
            <section className="backup-card">
              <div><strong>{t("HTML export за браузър")}</strong><p>{t("Сваля стандартен HTML файл за Chrome, Edge, Firefox и други браузъри.")}</p></div>
              <button className="category-button" onClick={exportBrowserBookmarks}><Globe2 size={17} />{t("Свали HTML")}</button>
            </section>
            <section className="backup-card">
              <div><strong>{t("Импорт от WebVault")}</strong><p>{t("Добавя липсващите записи от WebVault без да презаписва текущите.")}</p></div>
              <button className="category-button" onClick={() => importInputRef.current?.click()} disabled={importBusy}><Upload size={17} />{t("Избери JSON")}</button>
            </section>
            <section className="backup-card">
              <div><strong>{t("Импорт от Chrome")}</strong><p>{t("Импортира папките като категории и запазва подредбата на отметките.")}</p></div>
              <button className="category-button" onClick={() => chromeInputRef.current?.click()} disabled={importBusy}><Globe2 size={17} />{t("Избери HTML")}</button>
            </section>
            <section className="backup-card">
              <div><strong>{t("Примерна колекция")}</strong><p>{t("Добавя шест примерни отметки, които можеш да редактираш или изтриеш.")}</p></div>
              <button className="category-button" onClick={() => setImportPreview(sampleCollection())} disabled={importBusy}><Sparkles size={17} />{t("Прегледай примера")}</button>
            </section>
            {importPreview && <div className="import-preview">
              <strong>{importPreview.source === "chrome" ? "Chrome: " : importPreview.source === "sample" ? `${t("Примерна колекция")}: ` : "WebVault: "}{importPreview.fileName}</strong>
              <span>{importPreview.categories.length} {t("категории")} · {importPreview.sites.length} {t("сайта")}{importPreview.invalidCount ? ` · ${importPreview.invalidCount} ${t("Невалидните записи ще бъдат пропуснати")}` : ""}</span>
              <button className="add-button" onClick={() => void importBackup()} disabled={importBusy}>{importBusy ? <LoaderCircle size={18} className="spin" /> : <Upload size={17} />}{t(importBusy ? "Импортваме…" : "Добави данните")}</button>
            </div>}
            {importError && <p className="form-error">{importError}</p>}
            {importSuccess && <p className="import-success">{importSuccess}</p>}
          </div>
          <div className="modal-actions"><button className="cancel" onClick={() => setShowBackupDialog(false)}>{t("Затвори")}</button></div>
        </DialogContent>
      </Dialog>
      <Dialog open={showInstallDialog} onOpenChange={setShowInstallDialog}><DialogContent className="dialog-panel install-dialog"><DialogHeader className="dialog-heading"><span className="modal-icon"><Smartphone size={20} /></span><div><DialogTitle>{t("Инсталирай WebVault")}</DialogTitle><DialogDescription>{t("Отваряй приложението от началния екран като самостоятелно приложение.")}</DialogDescription></div></DialogHeader>{isInstalled ? <div className="install-status"><strong>{t("WebVault вече е инсталиран")}</strong><p>{t("Можеш да го отваряш директно от началния екран или менюто с приложения.")}</p></div> : installPrompt ? <div className="install-status"><strong>{t("Готово за инсталиране")}</strong><p>{t("Натисни бутона и потвърди инсталирането в браузъра.")}</p><button className="add-button" onClick={() => void installApp()}><Smartphone size={18} />{t("Инсталирай WebVault")}</button></div> : <div className="install-guides"><div><strong>{t("iPhone / iPad")}</strong><p>{t("Отвори менюто Share в Safari и избери „Add to Home Screen“.")}</p></div><div><strong>{t("Android / Windows")}</strong><p>{t("Отвори менюто на Chrome и избери „Install app“ или „Добавяне към началния екран“.")}</p></div></div>}<div className="modal-actions"><button className="cancel" onClick={() => setShowInstallDialog(false)}>{t("Затвори")}</button></div></DialogContent></Dialog>
      <ProfileSettingsV2 key={`${showProfile ? "open" : "closed"}-${displayName}`} open={showProfile} onOpenChange={setShowProfile} email={session.user.email ?? ""} displayName={displayName} onSaveDisplayName={saveDisplayName} language={language} setLanguage={setLanguage} dark={dark} setDark={setDark} onSignOut={signOut} t={t} />
      <AlertDialog open={Boolean(deleteCategoryTarget)} onOpenChange={(open) => !open && setDeleteCategoryTarget(null)}><AlertDialogContent className="confirm-dialog"><AlertDialogHeader><AlertDialogTitle>{t("Да изтрия ли категорията?")} „{categoryDisplayName(deleteCategoryTarget?.name ?? "", language)}“?</AlertDialogTitle><AlertDialogDescription>{t("Категорията ще бъде премахната. Сайтовете в нея няма да се загубят — ще бъдат преместени в „Други“.")}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="cancel">{t("Отказ")}</AlertDialogCancel><AlertDialogAction className="delete-action" disabled={categoryBusy} onClick={() => void confirmDeleteCategory()}>{t("Изтрий категорията")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={Boolean(deleteSiteTarget)} onOpenChange={(open) => !open && setDeleteSiteTarget(null)}><AlertDialogContent className="confirm-dialog"><AlertDialogHeader><AlertDialogTitle>{t("Да изтрия ли сайта?")} „{deleteSiteTarget?.name ?? ""}“?</AlertDialogTitle><AlertDialogDescription>{t("Това действие ще премахне сайта от твоя списък окончателно.")}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="cancel">{t("Отказ")}</AlertDialogCancel><AlertDialogAction className="delete-action" onClick={() => void confirmDeleteSite()}>{t("Изтрий сайта")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </main>
  );
}

function ProfileSettings({ open, onOpenChange, email, language, setLanguage, dark, setDark, onSignOut, t }: { open: boolean; onOpenChange: (open: boolean) => void; email: string; language: DashboardLanguage; setLanguage: (language: DashboardLanguage) => void; dark: boolean; setDark: (dark: boolean) => void; onSignOut: () => Promise<void>; t: (value: string) => string }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  function resetFeedback() { setMessage(""); setError(""); }
  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetFeedback();
    if (password.length < 8) return setError(t("Паролата трябва да е поне 8 символа."));
    if (password !== confirmation) return setError(t("Паролите не съвпадат."));
    if (!supabase) return setError("Supabase unavailable");
    setBusy(true);
    const result = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (result.error) return setError(result.error.message);
    setPassword("");
    setConfirmation("");
    setMessage(t("Паролата е обновена."));
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="dialog-panel profile-dialog"><DialogHeader className="dialog-heading"><span className="modal-icon"><UserCircle size={20} /></span><div><DialogTitle>{t("Профил и настройки")}</DialogTitle><DialogDescription>{t("Профилът ти")}</DialogDescription></div></DialogHeader><div className="profile-stack"><section className="profile-card"><div className="profile-card-heading"><UserCircle size={18} /><strong>{t("Имейл")}</strong></div><p className="profile-email">{email}</p><small>{t("Този имейл е свързан с акаунта ти.")}</small></section><section className="profile-card"><div className="profile-card-heading"><Settings2 size={18} /><strong>{t("Език")}</strong></div><div className="profile-choice-row"><button className={language === "en" ? "profile-choice active" : "profile-choice"} onClick={() => setLanguage("en")}>English</button><button className={language === "bg" ? "profile-choice active" : "profile-choice"} onClick={() => setLanguage("bg")}>Български</button></div></section><section className="profile-card"><div className="profile-card-heading"><Sun size={18} /><strong>{t("Тема")}</strong></div><div className="profile-choice-row"><button className={!dark ? "profile-choice active" : "profile-choice"} onClick={() => setDark(false)}>{t("Светла")}</button><button className={dark ? "profile-choice active" : "profile-choice"} onClick={() => setDark(true)}>{t("Тъмна")}</button></div></section><form className="profile-card profile-form" onSubmit={updatePassword}><div className="profile-card-heading"><KeyRound size={18} /><strong>{t("Смени паролата")}</strong></div><label>{t("Нова парола")}<input type="password" value={password} onChange={(event) => { setPassword(event.target.value); resetFeedback(); }} placeholder={t("Въведи нова парола")} minLength={8} autoComplete="new-password" /></label><label>{t("Потвърди новата парола")}<input type="password" value={confirmation} onChange={(event) => { setConfirmation(event.target.value); resetFeedback(); }} placeholder={t("Потвърди новата парола")} minLength={8} autoComplete="new-password" /></label>{error && <p className="form-error">{error}</p>}{message && <p className="import-success">{message}</p>}<button className="add-button" disabled={busy}>{busy ? <LoaderCircle size={17} className="spin" /> : <KeyRound size={17} />}{t("Запази паролата")}</button></form></div><div className="profile-footer"><button className="text-button danger-item" onClick={() => void onSignOut()}><LogOut size={16} />{t("Излез от акаунта")}</button><button className="add-button" onClick={() => onOpenChange(false)}>{t("Готово")}</button></div></DialogContent></Dialog>;
}

function ProfileSettingsV2({ open, onOpenChange, email, displayName, onSaveDisplayName, language, setLanguage, dark, setDark, onSignOut, t }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  displayName: string;
  onSaveDisplayName: (name: string) => Promise<string | null>;
  language: DashboardLanguage;
  setLanguage: (language: DashboardLanguage) => void;
  dark: boolean;
  setDark: (dark: boolean) => void;
  onSignOut: () => Promise<void>;
  t: (value: string) => string;
}) {
  const [displayNameDraft, setDisplayNameDraft] = useState(displayName);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [nameBusy, setNameBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [deleteAccountBusy, setDeleteAccountBusy] = useState(false);
  const [confirmAccountDeletion, setConfirmAccountDeletion] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function resetFeedback() {
    setMessage("");
    setError("");
  }

  async function updateDisplayName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetFeedback();
    const nextName = displayNameDraft.trim().replace(/\s+/g, " ");
    if (nextName.length < 2) return setError(t("Името трябва да е поне 2 символа."));
    setNameBusy(true);
    const saveError = await onSaveDisplayName(nextName);
    setNameBusy(false);
    if (saveError) return setError(saveError);
    setDisplayNameDraft(nextName);
    setMessage(t("Името е запазено."));
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetFeedback();
    if (password.length < 8) return setError(t("Паролата трябва да е поне 8 символа."));
    if (password !== confirmation) return setError(t("Паролите не съвпадат."));
    if (!supabase) return setError(t("Връзката с профила не е налична."));
    setPasswordBusy(true);
    const result = await supabase.auth.updateUser({ password });
    setPasswordBusy(false);
    if (result.error) return setError(result.error.message);
    setPassword("");
    setConfirmation("");
    setMessage(t("Паролата е обновена."));
  }

  function openDeletionResource() {
    void (async () => {
      const opened = await openInNativeBrowser("https://webvault.site/delete-account").catch(() => false);
      if (!opened) window.open("/delete-account", "_blank", "noopener,noreferrer");
    })();
  }

  async function deleteAccount() {
    resetFeedback();
    if (!supabase) return setError(t("Връзката с профила не е налична."));

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) return setError(t("Сесията е изтекла. Влез отново, преди да изтриеш акаунта."));

    setDeleteAccountBusy(true);
    try {
      const response = await fetch(webVaultApiUrl("/api/account/delete"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });
      if (!response.ok) throw new Error("Account deletion request failed.");

      setConfirmAccountDeletion(false);
      await onSignOut();
      onOpenChange(false);
    } catch {
      setError(t("Не успяхме да изтрием акаунта. Опитай отново или използвай страницата за изтриване."));
    } finally {
      setDeleteAccountBusy(false);
    }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="dialog-panel profile-dialog"><DialogHeader className="dialog-heading"><span className="modal-icon"><UserCircle size={20} /></span><div><DialogTitle>{t("Профил и настройки")}</DialogTitle><DialogDescription>{t("Профилът ти")}</DialogDescription></div></DialogHeader><div className="profile-stack">
    <form className="profile-card profile-form" onSubmit={updateDisplayName}><div className="profile-card-heading"><UserCircle size={18} /><strong>{t("Име в профила")}</strong></div><small>{t("Това име се вижда в поздрава и аватара.")}</small><label><input value={displayNameDraft} onChange={(event) => { setDisplayNameDraft(event.target.value); resetFeedback(); }} placeholder={t("Въведи име за профила")} minLength={2} maxLength={80} autoComplete="name" required /></label><button className="add-button" disabled={nameBusy}>{nameBusy ? <LoaderCircle size={17} className="spin" /> : <UserCircle size={17} />}{t("Запази името")}</button></form>
    <section className="profile-card"><div className="profile-card-heading"><UserCircle size={18} /><strong>{t("Имейл")}</strong></div><p className="profile-email">{email}</p><small>{t("Този имейл е свързан с акаунта ти.")}</small></section>
    <section className="profile-card"><div className="profile-card-heading"><Settings2 size={18} /><strong>{t("Език")}</strong></div><div className="profile-choice-row"><button className={language === "en" ? "profile-choice active" : "profile-choice"} onClick={() => setLanguage("en")}>English</button><button className={language === "bg" ? "profile-choice active" : "profile-choice"} onClick={() => setLanguage("bg")}>Български</button></div></section>
    <section className="profile-card"><div className="profile-card-heading"><Sun size={18} /><strong>{t("Тема")}</strong></div><div className="profile-choice-row"><button className={!dark ? "profile-choice active" : "profile-choice"} onClick={() => setDark(false)}>{t("Светла")}</button><button className={dark ? "profile-choice active" : "profile-choice"} onClick={() => setDark(true)}>{t("Тъмна")}</button></div></section>
    <form className="profile-card profile-form" onSubmit={updatePassword}><div className="profile-card-heading"><KeyRound size={18} /><strong>{t("Смени паролата")}</strong></div><label>{t("Нова парола")}<input type="password" value={password} onChange={(event) => { setPassword(event.target.value); resetFeedback(); }} placeholder={t("Въведи нова парола")} minLength={8} autoComplete="new-password" /></label><label>{t("Потвърди новата парола")}<input type="password" value={confirmation} onChange={(event) => { setConfirmation(event.target.value); resetFeedback(); }} placeholder={t("Потвърди новата парола")} minLength={8} autoComplete="new-password" /></label><button className="add-button" disabled={passwordBusy}>{passwordBusy ? <LoaderCircle size={17} className="spin" /> : <KeyRound size={17} />}{t("Запази паролата")}</button></form>
    <section className="profile-card"><div className="profile-card-heading"><Trash2 size={18} /><strong>{t("Изтриване на акаунта")}</strong></div><small>{t("Изтриваш окончателно профила, отметките, категориите, устройства и качените икони. Ако имаш активен абонамент през Stripe, той ще бъде отменен.")}</small><div className="profile-account-actions"><button type="button" className="profile-choice" onClick={openDeletionResource}>{t("Политика и помощ")}</button><button type="button" className="profile-choice danger-item" onClick={() => { resetFeedback(); setConfirmAccountDeletion(true); }}><Trash2 size={15} />{t("Изтрий акаунта")}</button></div></section>
    {(error || message) && <p className={error ? "form-error" : "import-success"}>{error || message}</p>}
  </div><div className="profile-footer"><button className="text-button danger-item" onClick={() => void onSignOut()}><LogOut size={16} />{t("Излез от акаунта")}</button><button className="add-button" onClick={() => onOpenChange(false)}>{t("Готово")}</button></div><AlertDialog open={confirmAccountDeletion} onOpenChange={setConfirmAccountDeletion}><AlertDialogContent className="confirm-dialog"><AlertDialogHeader><AlertDialogTitle>{t("Да изтрия ли акаунта?")}</AlertDialogTitle><AlertDialogDescription>{t("Това действие е окончателно. Ще изтрием твоите WebVault данни. Активен абонамент през Stripe ще бъде отменен веднага.")}</AlertDialogDescription>{error && <p className="form-error">{error}</p>}</AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="cancel" disabled={deleteAccountBusy}>{t("Отказ")}</AlertDialogCancel><AlertDialogAction className="delete-action" disabled={deleteAccountBusy} onClick={(event) => { event.preventDefault(); void deleteAccount(); }}>{deleteAccountBusy ? <LoaderCircle size={17} className="spin" /> : <Trash2 size={17} />}{t("Изтрий акаунта")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></DialogContent></Dialog>;
}

function SiteIcon({ site }: { site: Site }) {
  const iconUrl = site.customIconUrl ?? site.faviconUrl;
  const [failedIconUrl, setFailedIconUrl] = useState<string | null>(null);
  const failed = failedIconUrl === iconUrl;
  return <span className="site-logo" style={{ background: displayColor(site.id) }}>{iconUrl && !failed ? <img src={iconUrl} alt="" onError={() => setFailedIconUrl(iconUrl)} /> : glyphFor(site)}</span>;
}

function HighlightText({ text, query }: { text: string; query: string }) {
  const value = query.trim();
  if (!value) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegExp(value)})`, "ig"));
  return <>{parts.map((part, index) => part.toLocaleLowerCase("bg") === value.toLocaleLowerCase("bg") ? <mark key={`${part}-${index}`}>{part}</mark> : <span key={`${part}-${index}`}>{part}</span>)}</>;
}

function SiteSection({ title, icon, tone, sites, category, isFirst, isLast, collapsed, draggedCategoryId, onManage, onMove, onDeleteCategory, onChangeTone, onCollapseAll, onToggleCollapse, onCategoryDragStart, onCategoryDrop, onAddSite, onOpenSite, onToggleFavorite, onEdit, onDelete, draggedSiteId, dropTargetSiteId, siteOrderBusy, onStartSiteDrag, onSiteDragOver, onMoveSite, onEndSiteDrag, highlightQuery, newlyAddedSiteId, t = (value: string) => value }: {
  title: string;
  icon: string;
  tone: string;
  sites: Site[];
  category?: Category;
  isFirst?: boolean;
  isLast?: boolean;
  collapsed?: boolean;
  draggedCategoryId?: string | null;
  onManage?: () => void;
  onMove?: (id: string, direction: -1 | 1) => void;
  onDeleteCategory?: (category: Category) => void;
  onChangeTone?: () => void;
  onCollapseAll?: () => void;
  onToggleCollapse?: () => void;
  onCategoryDragStart?: (event: ReactDragEvent<HTMLElement>, id: string) => void;
  onCategoryDrop?: (id: string) => void;
  onAddSite?: (categoryId?: string) => void;
  onOpenSite: (site: Site) => void;
  onToggleFavorite: (id: string) => void;
  onEdit: (site: Site) => void;
  onDelete: (site: Site) => void;
  draggedSiteId?: string | null;
  dropTargetSiteId?: string | null;
  siteOrderBusy?: boolean;
  onStartSiteDrag?: (event: ReactDragEvent<HTMLElement>, siteId: string) => void;
  onSiteDragOver?: (siteId: string | null) => void;
  onMoveSite?: (siteId: string, categoryId: string, targetSiteId?: string) => void;
  onEndSiteDrag?: () => void;
  highlightQuery?: string;
  newlyAddedSiteId?: string | null;
  t?: (value: string) => string;
}) {
  const canReorder = Boolean(category && onMoveSite && onStartSiteDrag);
  const categoryHeader = Boolean(category);
  return <section className={`site-section ${collapsed ? "is-collapsed" : ""}`}>
    <div className={`section-title ${draggedCategoryId === category?.id ? "category-dragging" : ""}`} draggable={categoryHeader} onClick={() => category && onToggleCollapse?.()} onDragStart={(event) => category && onCategoryDragStart?.(event, category.id)} onDragOver={(event) => { if (category && draggedCategoryId && draggedCategoryId !== category.id) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } }} onDrop={(event) => { if (category && draggedCategoryId) { event.preventDefault(); event.stopPropagation(); onCategoryDrop?.(category.id); } }}>
      {category ? <button type="button" className={`section-icon ${tone} category-icon-button`} title={t("Промени иконата")} onClick={(event) => { event.stopPropagation(); onManage?.(); }}>{icon}</button> : <span className={`section-icon ${tone}`}>{icon}</span>}
      <div className="section-heading"><h2><HighlightText text={title} query={highlightQuery ?? ""} /></h2><p>{sites.length} {sites.length === 1 ? t("сайт") : t("сайта")}</p></div>
      {category && <button type="button" className="section-collapse" title={collapsed ? t("Разгъни категорията") : t("Свий категорията")} aria-label={collapsed ? t("Разгъни категорията") : t("Свий категорията")} aria-expanded={!collapsed} onClick={(event) => { event.stopPropagation(); onToggleCollapse?.(); }}><ChevronDown size={17} /></button>}
      {category && <DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="section-menu-trigger" aria-label={`${t("Действия за")} ${title}`} title={t("Действия за")} onClick={(event) => event.stopPropagation()}><MoreHorizontal size={19} /></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="category-menu"><DropdownMenuItem onSelect={onManage}><Pencil size={15} /> {t("Преименувай")}</DropdownMenuItem><DropdownMenuItem onSelect={onManage}><Sparkles size={15} /> {t("Промени иконата")}</DropdownMenuItem><DropdownMenuItem onSelect={onChangeTone}><Palette size={15} /> {t("Промени цвета")}</DropdownMenuItem><DropdownMenuItem disabled={isFirst} onSelect={() => onMove?.(category.id, -1)}><ChevronUp size={15} /> {t("Премести нагоре")}</DropdownMenuItem><DropdownMenuItem disabled={isLast} onSelect={() => onMove?.(category.id, 1)}><ChevronDown size={15} /> {t("Премести надолу")}</DropdownMenuItem><DropdownMenuItem onSelect={onCollapseAll}><ChevronDown size={15} /> {t("Свий всички")}</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem className="danger-item" disabled={category.isSystem} onSelect={() => onDeleteCategory?.(category)}><Trash2 size={15} /> {t("Изтрий")}</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}
    </div>
    <div className={`collapsible-body ${collapsed ? "collapsed" : ""}`}><div>{sites.length ? <div className="site-grid">{sites.map((site) => <article className={`site-card ${draggedSiteId === site.id ? "dragging" : ""} ${dropTargetSiteId === site.id && draggedSiteId !== site.id ? "drop-target" : ""} ${newlyAddedSiteId === site.id ? "site-card-pulse" : ""}`} data-site-id={site.id} key={site.id} tabIndex={0} role="link" aria-label={`${site.name} — ${site.domain}`} draggable={canReorder && !siteOrderBusy} onClick={() => onOpenSite(site)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpenSite(site); } }} onDragStart={(event) => onStartSiteDrag?.(event, site.id)} onDragOver={(event) => { if (!canReorder) return; event.preventDefault(); event.dataTransfer.dropEffect = "move"; onSiteDragOver?.(site.id); }} onDrop={(event) => { if (!canReorder || !category || !draggedSiteId) return; event.preventDefault(); event.stopPropagation(); void onMoveSite?.(draggedSiteId, category.id, site.id); }} onDragEnd={onEndSiteDrag}><button type="button" className={`star ${site.favorite ? "active" : ""}`} onClick={(event) => { event.stopPropagation(); void onToggleFavorite(site.id); }} aria-label={t("Добави или премахни от любими")} title={t("Добави или премахни от любими")}><Star size={17} fill={site.favorite ? "currentColor" : "none"} /></button>{canReorder && <span className="site-drag" title={t("Влачи, за да преместиш")} onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}><GripVertical size={15} /></span>}<button type="button" className="site-edit" onClick={(event) => { event.stopPropagation(); onEdit(site); }} aria-label={`${t("Редактирай сайт")} ${site.name}`} title={t("Редактирай сайт")}><Pencil size={14} /></button><div className="site-card-content"><SiteIcon site={site} /><span className="site-copy"><strong><HighlightText text={site.name} query={highlightQuery ?? ""} /></strong><small><HighlightText text={site.domain} query={highlightQuery ?? ""} /></small>{site.description && <p><HighlightText text={site.description} query={highlightQuery ?? ""} /></p>}</span><span className="open-arrow" title={t("Външна връзка")}><ExternalLink size={15} /></span></div><button type="button" className="site-delete" onClick={(event) => { event.stopPropagation(); onDelete(site); }} aria-label={`${t("Изтрий сайта")} ${site.name}`} title={t("Изтрий сайта")}><Trash2 size={14} /></button></article>)}</div> : <button className={`category-empty ${draggedSiteId && canReorder ? "drop-ready" : ""}`} onDragOver={(event) => { if (!canReorder) return; event.preventDefault(); event.dataTransfer.dropEffect = "move"; onSiteDragOver?.(null); }} onDrop={(event) => { if (!canReorder || !category || !draggedSiteId) return; event.preventDefault(); void onMoveSite?.(draggedSiteId, category.id); }} onClick={() => onAddSite?.(category?.id)}><Plus size={18} /><span><strong>{t("Добави първия сайт")}</strong><small>{draggedSiteId ? t("Пусни сайта тук") : t("Тази категория все още е празна")}</small></span></button>}</div></div>
  </section>;
}
