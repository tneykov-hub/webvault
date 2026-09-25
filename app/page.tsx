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
  Медиа: "Media",
  Медия: "Media",
  Тенор: "Coach",
  Тенис: "Tennis",
  Тренер: "Coach",
  Треньор: "Coach",
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

  function openUpgradeDialog(reason = "Стани PRO за неограничени сайтове, категории и всички premium функции.") {
    setUpgradeReason(reason);
    setShowUpgradeDialog(true);
  }

  function openAddSite(categoryId?: string) {
    if (!subscription.isPro && siteItems.length >= FREE_SITE_LIMIT) {
      openUpgradeDialog("Достигна лимита на безплатния план. Стани PRO за неограничени сайтове.");
      return;
    }
    if (siteIconPreview?.startsWith("blob:")) URL.revokeObjectURL(siteIconPreview);
    setEditingSite(null);
    setSiteDraft({ ...emptySiteDraft, categoryId: categoryId ?? categories[0]?.id ?? "" });
    setSiteIconFile(null);
    setSiteIconPreview(null);
    setDetectedFavicon(null);
    setRemoveCustomIcon(false);
    setShowInlineCategoryCreate(false);
    setInlineCategoryName("");
    titleTouchedRef.current = false;
    descriptionTouchedRef.current = false;
    categoryTouchedRef.current = Boolean(categoryId);
    metadataFetchedForRef.current = "";
    setSiteError("");
    setShowSiteDialog(true);
  }

  function openEditSite(site: Site) {
    if (siteIconPreview?.startsWith("blob:")) URL.revokeObjectURL(siteIconPreview);
    setEditingSite(site);
    setSiteDraft({ name: site.name, url: site.url, categoryId: site.categoryId ?? categories[0]?.id ?? "", description: site.description, favorite: site.favorite, openInNewTab: site.openInNewTab !== false });
    setSiteIconFile(null);
    setSiteIconPreview(site.customIconUrl);
    setDetectedFavicon(site.faviconUrl);
    setRemoveCustomIcon(false);
    setShowInlineCategoryCreate(false);
    titleTouchedRef.current = true;
    descriptionTouchedRef.current = Boolean(site.description);
    categoryTouchedRef.current = true;
    metadataFetchedForRef.current = "";
    setSiteError("");
    setShowSiteDialog(true);
  }

  function closeSiteDialog() {
    if (siteIconPreview?.startsWith("blob:")) URL.revokeObjectURL(siteIconPreview);
    setSiteIconFile(null);
    setSiteIconPreview(null);
    setDetectedFavicon(null);
    setRemoveCustomIcon(false);
    setShowInlineCategoryCreate(false);
    setInlineCategoryName("");
    setShowSiteDialog(false);
  }

  async function fetchMetadataForUrl(rawUrl: string) {
    const details = cleanHttpUrl(rawUrl);
    if (!details || (!details.domain.includes(".") && details.domain !== "localhost")) return;
    if (metadataFetchedForRef.current === details.url) return;
    metadataFetchedForRef.current = details.url;
    setMetadataBusy(true);
    try {
      const response = await fetch(webVaultApiUrl("/api/metadata"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: details.url }) });
      const metadata = (await response.json()) as { title?: unknown; description?: unknown; faviconUrl?: unknown };
      const title = typeof metadata.title === "string" && metadata.title.trim() ? metadata.title.trim().slice(0, 120) : details.domain;
      const description = cleanDescription(metadata.description);
      const faviconUrl = typeof metadata.faviconUrl === "string" ? metadata.faviconUrl : faviconFor(details.url);
      const suggestedId = suggestedCategoryId(categories, details.url);
      setDetectedFavicon(faviconUrl);
      setSiteDraft((draft) => ({ ...draft, name: titleTouchedRef.current ? draft.name : title, description: descriptionTouchedRef.current ? draft.description : description, categoryId: !categoryTouchedRef.current && suggestedId ? suggestedId : draft.categoryId }));
    } catch {
      const suggestedId = suggestedCategoryId(categories, details.url);
      setDetectedFavicon(faviconFor(details.url));
      setSiteDraft((draft) => ({ ...draft, name: titleTouchedRef.current ? draft.name : details.domain, categoryId: !categoryTouchedRef.current && suggestedId ? suggestedId : draft.categoryId }));
    } finally {
      setMetadataBusy(false);
    }
  }

  function selectSiteIcon(file: File) {
    if (!subscription.isPro) {
      openUpgradeDialog("Собствените икони за сайтове са налични с WebVault PRO.");
      return;
    }
    setSiteError("");
    if (!iconMimeExtensions[file.type]) return setSiteError("Избери PNG, JPG, WebP или GIF изображение.");
    if (file.size > 2 * 1024 * 1024) return setSiteError("Иконата трябва да е по-малка от 2 MB.");
    if (siteIconPreview?.startsWith("blob:")) URL.revokeObjectURL(siteIconPreview);
    setSiteIconFile(file);
    setSiteIconPreview(URL.createObjectURL(file));
    setRemoveCustomIcon(false);
  }

  function clearCustomIcon() {
    if (siteIconPreview?.startsWith("blob:")) URL.revokeObjectURL(siteIconPreview);
    setSiteIconFile(null);
    setSiteIconPreview(null);
    setRemoveCustomIcon(Boolean(editingSite?.customIconUrl));
    if (siteIconInputRef.current) siteIconInputRef.current.value = "";
  }

  function handleCategorySelection(value: string) {
    if (value === "__new__") {
      categoryTouchedRef.current = true;
      setSiteDraft((draft) => ({ ...draft, categoryId: "" }));
      setShowInlineCategoryCreate(true);
      return;
    }
    categoryTouchedRef.current = true;
    setShowInlineCategoryCreate(false);
    setSiteDraft((draft) => ({ ...draft, categoryId: value }));
  }

  async function createInlineCategory() {
    if (!supabase) return;
    if (!subscription.isPro && categories.length >= FREE_CATEGORY_LIMIT) {
      openUpgradeDialog("Безплатният план включва до 3 категории. Стани PRO за неограничени категории.");
      return;
    }
    const name = inlineCategoryName.trim();
    if (!name) return setSiteError("Въведи име на категорията.");
    if (categories.some((category) => normalizedName(category.name) === normalizedName(name))) return setSiteError("Вече има категория с това име.");
    const result = await supabase.from("categories").insert({ user_id: session.user.id, name, icon: "🔖", tone: "blue", position: Math.max(0, ...categories.map((category) => category.position)) + 100 }).select("id,name,icon,tone,position,is_system").single();
    if (result.error || !result.data) return setSiteError("Категорията не беше добавена. Опитай отново.");
    const category = asCategory(result.data as Record<string, unknown>);
    setCategories((items) => [...items, category]);
    setSiteDraft((draft) => ({ ...draft, categoryId: category.id }));
    setInlineCategoryName("");
    setShowInlineCategoryCreate(false);
    setSiteError("");
  }

  function storedIconPath(url: string | null) {
    if (!url) return null;
    const marker = "/storage/v1/object/public/site-icons/";
    const index = url.indexOf(marker);
    if (index < 0) return null;
    const path = decodeURIComponent(url.slice(index + marker.length));
    return path.startsWith(`${session.user.id}/`) ? path : null;
  }

  async function uploadSiteIcon(file: File, siteId: string) {
    if (!supabase) throw new Error("Supabase unavailable");
    if (!subscription.isPro) throw new Error("WebVault PRO is required for custom icons.");
    const extension = iconMimeExtensions[file.type];
    if (!extension || file.size > 2 * 1024 * 1024) throw new Error("Invalid icon");
    const path = `${session.user.id}/${siteId}-${Date.now()}.${extension}`;
    const upload = await supabase.storage.from("site-icons").upload(path, file, { cacheControl: "31536000", contentType: file.type, upsert: false });
    if (upload.error) throw upload.error;
    const publicUrl = supabase.storage.from("site-icons").getPublicUrl(path).data.publicUrl;
    const update = await supabase.from("sites").update({ custom_icon_url: publicUrl }).eq("id", siteId);
    if (update.error) {
      void supabase.storage.from("site-icons").remove([path]);
      throw update.error;
    }
    return publicUrl;
  }

  function openBackupManager() {
    setImportPreview(null);
    setImportError("");
    setImportSuccess("");
    setShowBackupDialog(true);
  }

  function importBookmarksFromSiteModal() {
    setShowSiteDialog(false);
    openBackupManager();
    window.setTimeout(() => chromeInputRef.current?.click(), 120);
  }

  function openBookmarkImport() {
    openBackupManager();
    window.setTimeout(() => chromeInputRef.current?.click(), 120);
  }

  function openSampleCollection() {
    setImportError("");
    setImportSuccess("");
    setImportPreview(sampleCollection());
    setShowBackupDialog(true);
  }

  function openInstallManager() {
    if (!subscription.isPro) {
      openUpgradeDialog("PWA инсталацията е налична с WebVault PRO.");
      return;
    }
    setShowInstallDialog(true);
  }

  async function installApp() {
    if (!subscription.isPro) return openUpgradeDialog("PWA инсталацията е налична с WebVault PRO.");
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstallPrompt(null);
  }

  function exportBackup() {
    const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));
    const backup = { app: "webvault", version: 1, exportedAt: new Date().toISOString(), categories: [...categories].sort((first, second) => first.position - second.position).map(({ name, icon, tone, position }) => ({ name, icon, tone, position })), sites: [...siteItems].sort(byPosition).map((site) => ({ name: site.name, url: site.url, domain: site.domain, description: site.description, categoryName: categoryNameById.get(site.categoryId ?? "") ?? "Други", favorite: site.favorite, faviconUrl: site.faviconUrl, customIconUrl: site.customIconUrl, openInNewTab: site.openInNewTab, position: site.position })) };
    downloadTextFile(JSON.stringify(backup, null, 2), `webvault-backup-${new Date().toISOString().slice(0, 10)}.json`, "application/json;charset=utf-8");
  }

  function exportBrowserBookmarks() {
    const sortedCategories = [...categories].sort((first, second) => first.position - second.position);
    const knownCategoryIds = new Set(sortedCategories.map((category) => category.id));
    const renderLinks = (sites: Site[]) => sites
      .sort(byPosition)
      .map((site) => {
        const description = site.description ? `\n        <DD>${escapeBookmarkHtml(site.description)}` : "";
        return `        <DT><A HREF="${escapeBookmarkHtml(site.url)}">${escapeBookmarkHtml(site.name)}</A>${description}`;
      })
      .join("\n");
    const sections = sortedCategories.flatMap((category) => {
      const sites = siteItems.filter((site) => site.categoryId === category.id);
      if (!sites.length) return [];
      return [`    <DT><H3>${escapeBookmarkHtml(category.name)}</H3>\n    <DL><p>\n${renderLinks(sites)}\n    </DL><p>`];
    });
    const uncategorized = siteItems.filter((site) => !site.categoryId || !knownCategoryIds.has(site.categoryId));
    if (uncategorized.length) sections.push(`    <DT><H3>Other</H3>\n    <DL><p>\n${renderLinks(uncategorized)}\n    </DL><p>`);
    const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>WebVault Bookmarks</TITLE>\n<H1>WebVault Bookmarks</H1>\n<DL><p>\n${sections.join("\n")}\n</DL><p>\n`;
    downloadTextFile(html, `webvault-bookmarks-${new Date().toISOString().slice(0, 10)}.html`, "text/html;charset=utf-8");
  }

  async function prepareImport(file: File) {
    setImportError("");
    setImportSuccess("");
    setImportPreview(null);
    if (file.size > 5 * 1024 * 1024) return setImportError("Файлът е твърде голям. Избери JSON backup до 5 MB.");
    try {
      const raw = JSON.parse(await file.text()) as unknown;
      if (!isRecord(raw) || !["webvault", "my-sites"].includes(String(raw.app)) || raw.version !== 1 || !Array.isArray(raw.categories) || !Array.isArray(raw.sites)) throw new Error("unsupported");
      const categoriesByName = new Map<string, BackupCategory>();
      for (const value of raw.categories) {
        if (!isRecord(value) || typeof value.name !== "string") continue;
        const name = value.name.trim().slice(0, 64);
        if (!name || categoriesByName.has(normalizedName(name))) continue;
        const icon = typeof value.icon === "string" && value.icon.trim() ? value.icon.trim().slice(0, 16) : "🔖";
        const tone = typeof value.tone === "string" && allowedTones.has(value.tone) ? value.tone : "blue";
        const position = typeof value.position === "number" && Number.isFinite(value.position) && value.position >= 0 ? value.position : (categoriesByName.size + 1) * 100;
        categoriesByName.set(normalizedName(name), { name, icon, tone, position });
      }
      const sites: BackupSite[] = [];
      let invalidCount = 0;
      for (const value of raw.sites) {
        if (!isRecord(value) || typeof value.name !== "string" || typeof value.url !== "string") {
          invalidCount += 1;
          continue;
        }
        const name = value.name.trim().slice(0, 120);
        const urlDetails = cleanHttpUrl(value.url);
        if (!name || !urlDetails) {
          invalidCount += 1;
          continue;
        }
        const rawCategoryName = typeof value.categoryName === "string" && value.categoryName.trim() ? value.categoryName.trim().slice(0, 64) : "Други";
        const categoryKey = normalizedName(rawCategoryName);
        if (!categoriesByName.has(categoryKey)) categoriesByName.set(categoryKey, { name: rawCategoryName, icon: "🔖", tone: "blue", position: (categoriesByName.size + 1) * 100 });
        sites.push({ name, url: urlDetails.url, domain: urlDetails.domain, description: cleanDescription(value.description), categoryName: categoriesByName.get(categoryKey)?.name ?? "Други", favorite: value.favorite === true, faviconUrl: typeof value.faviconUrl === "string" && cleanHttpUrl(value.faviconUrl) ? value.faviconUrl : faviconFor(urlDetails.url), customIconUrl: typeof value.customIconUrl === "string" && cleanHttpUrl(value.customIconUrl) ? value.customIconUrl : null, openInNewTab: typeof value.openInNewTab === "boolean" ? value.openInNewTab : null, position: typeof value.position === "number" && Number.isFinite(value.position) && value.position >= 0 ? value.position : (sites.length + 1) * 100 });
      }
      if (!sites.length && !categoriesByName.size) throw new Error("empty");
      setImportPreview({ fileName: file.name, source: "backup", categories: [...categoriesByName.values()].sort((first, second) => first.position - second.position), sites, invalidCount });
    } catch {
      setImportError("Това не е валиден WebVault backup файл. Избери JSON, свален от „Експорт“.");
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  async function prepareChromeImport(file: File) {
    setImportError("");
    setImportSuccess("");
    setImportPreview(null);
    if (file.size > 20 * 1024 * 1024) return setImportError("Chrome файлът е твърде голям. Максималният размер е 20 MB.");
    try {
      const documentNode = new DOMParser().parseFromString(await file.text(), "text/html");
      const rootList = documentNode.querySelector("dl");
      if (!rootList) throw new Error("missing bookmarks");
      const categoriesByName = new Map<string, BackupCategory>();
      const sites: BackupSite[] = [];
      let invalidCount = 0;
      const tones = ["aqua", "violet", "amber", "blue", "rose", "green"];
      const categoryFor = (path: string[]) => {
        const name = (path.length ? path.join(" / ") : "Chrome").slice(0, 64);
        const key = normalizedName(name);
        if (!categoriesByName.has(key)) categoriesByName.set(key, { name, icon: path.length > 1 ? "📁" : "🌐", tone: tones[categoriesByName.size % tones.length], position: (categoriesByName.size + 1) * 100 });
        return categoriesByName.get(key)!;
      };
      const addAnchor = (anchor: HTMLAnchorElement, path: string[]) => {
        const urlDetails = cleanHttpUrl(anchor.href);
        const name = anchor.textContent?.trim().slice(0, 120) ?? "";
        if (!urlDetails || !name) {
          invalidCount += 1;
          return;
        }
        const category = categoryFor(path);
        sites.push({ name, url: urlDetails.url, domain: urlDetails.domain, description: "", categoryName: category.name, favorite: false, faviconUrl: faviconFor(urlDetails.url), customIconUrl: null, openInNewTab: null, position: (sites.length + 1) * 100 });
      };
      const walkList = (list: Element, path: string[]) => {
        let pendingFolder: string | null = null;
        for (const child of Array.from(list.children)) {
          if (child.tagName !== "DT") {
            if (child.tagName === "DL") {
              walkList(child, pendingFolder ? [...path, pendingFolder] : path);
              pendingFolder = null;
            }
            continue;
          }
          const directChildren = Array.from(child.children);
          const heading = directChildren.find((element) => element.tagName === "H3");
          const anchor = directChildren.find((element) => element.tagName === "A") as HTMLAnchorElement | undefined;
          const nestedList = directChildren.find((element) => element.tagName === "DL");
          if (heading) {
            const folder = heading.textContent?.trim() || "Chrome";
            if (nestedList) walkList(nestedList, [...path, folder]);
            else pendingFolder = folder;
          } else if (anchor) {
            addAnchor(anchor, path);
          }
        }
      };
      walkList(rootList, []);
      if (!sites.length) throw new Error("empty bookmarks");
      setImportPreview({ fileName: file.name, source: "chrome", categories: [...categoriesByName.values()], sites, invalidCount });
    } catch {
      setImportError("Не открих валиден Chrome bookmarks файл. В Chrome избери Bookmarks → Bookmark manager → Export bookmarks.");
    } finally {
      if (chromeInputRef.current) chromeInputRef.current.value = "";
    }
  }

  async function importBackup() {
    if (!supabase || !importPreview || importBusy) return;
    setImportBusy(true);
    setImportError("");
    const categoriesByKey = new Map(categories.map((category) => [normalizedName(category.name), category]));
    let reusedFreeCategories = 0;
    if (!subscription.isPro) {
      const requestedKeys = new Set(importPreview.categories.map((category) => normalizedName(category.name)));
      const categoriesWithSites = new Set(siteItems.map((site) => site.categoryId).filter((id): id is string => Boolean(id)));
      const reusableCategories = categories
        .filter((category) => !category.isSystem && !categoriesWithSites.has(category.id) && !requestedKeys.has(normalizedName(category.name)))
        .slice(0, Math.max(0, FREE_CATEGORY_LIMIT - 1));
      const missingFreeCategories = importPreview.categories.filter((category) => !categoriesByKey.has(normalizedName(category.name)));
      for (const category of missingFreeCategories) {
        const reusable = reusableCategories.shift();
        if (!reusable) break;
        const result = await supabase.from("categories").update({ name: category.name }).eq("id", reusable.id).select("id,name,icon,tone,position,is_system").single();
        if (result.error || !result.data) {
          setImportBusy(false);
          void loadData(true);
          return setImportError("Не успяхме да подготвим папките за импорта. Опитай отново.");
        }
        const updated = asCategory(result.data as Record<string, unknown>);
        categoriesByKey.delete(normalizedName(reusable.name));
        categoriesByKey.set(normalizedName(updated.name), updated);
        reusedFreeCategories += 1;
      }
    }
    const missingCategories = subscription.isPro
      ? importPreview.categories.filter((category) => !categoriesByKey.has(normalizedName(category.name)))
      : [];
    const nextCategoryPosition = Math.max(0, ...categories.map((category) => category.position));
    if (missingCategories.length) {
      const result = await supabase.from("categories").insert(missingCategories.map((category, index) => ({ user_id: session.user.id, name: category.name, icon: category.icon, tone: category.tone, position: nextCategoryPosition + (index + 1) * 100 }))).select("id,name,icon,tone,position,is_system");
      if (result.error || !result.data) {
        setImportBusy(false);
        return setImportError("Не успяхме да добавим новите категории. Нищо не беше импортнато.");
      }
      result.data.forEach((row) => {
        const category = asCategory(row as Record<string, unknown>);
        categoriesByKey.set(normalizedName(category.name), category);
      });
    }
    const fallbackCategory = categories.find((category) => category.isSystem)
      ?? categoriesByKey.get("други")
      ?? categoriesByKey.get("other")
      ?? categories[0]
      ?? categoriesByKey.values().next().value;
    if (!fallbackCategory) {
      setImportBusy(false);
      return setImportError("Не открихме категория, в която да добавим отметките.");
    }
    const remainingFreeSlots = subscription.isPro ? Number.POSITIVE_INFINITY : Math.max(0, FREE_SITE_LIMIT - siteItems.length);
    if (!remainingFreeSlots) {
      setImportBusy(false);
      return setImportError("Безплатният план вече съдържа 30 сайта. Изтрий сайт или премини към PRO, за да импортираш още.");
    }
    const existingSiteKeys = new Set(siteItems.map((site) => `${site.url.toLocaleLowerCase()}|${normalizedName(categoryNames.get(site.categoryId ?? "") ?? "Други")}`));
    const categoryCounts = new Map<string, number>();
    siteItems.forEach((site) => categoryCounts.set(site.categoryId ?? "", (categoryCounts.get(site.categoryId ?? "") ?? 0) + 1));
    const rows: Array<Record<string, unknown>> = [];
    let skippedDuplicates = 0;
    let skippedByLimit = 0;
    const remappedCategoryKeys = new Set<string>();
    for (const site of [...importPreview.sites].sort((first, second) => first.position - second.position || first.name.localeCompare(second.name, "bg"))) {
      const requestedCategoryKey = normalizedName(site.categoryName);
      const requestedCategory = categoriesByKey.get(requestedCategoryKey);
      const category = requestedCategory ?? fallbackCategory;
      if (!requestedCategory && !subscription.isPro) remappedCategoryKeys.add(requestedCategoryKey);
      const key = `${site.url.toLocaleLowerCase()}|${normalizedName(category.name)}`;
      if (existingSiteKeys.has(key)) {
        skippedDuplicates += 1;
        continue;
      }
      if (rows.length >= remainingFreeSlots) {
        skippedByLimit += 1;
        continue;
      }
      existingSiteKeys.add(key);
      const count = (categoryCounts.get(category.id) ?? 0) + 1;
      categoryCounts.set(category.id, count);
      rows.push({ user_id: session.user.id, category_id: category.id, name: site.name, url: site.url, domain: site.domain, description: cleanDescription(site.description) || null, favicon_url: site.faviconUrl, custom_icon_url: site.customIconUrl, is_favorite: site.favorite, open_in_new_tab: site.openInNewTab, position: count * 100 });
    }
    if (rows.length) {
      const result = await supabase.from("sites").insert(rows);
      if (result.error) {
        setImportBusy(false);
        void loadData(true);
        return setImportError("Някои данни не бяха импортнати. Обновихме списъка — опитай отново само ако липсват записи.");
      }
    }
    setImportBusy(false);
    setImportPreview(null);
    const preparedCategories = missingCategories.length + reusedFreeCategories;
    setImportSuccess(`Готово: добавени ${rows.length} сайта${preparedCategories ? ` и подготвени ${preparedCategories} категории` : ""}${remappedCategoryKeys.size ? ` · ${remappedCategoryKeys.size} папки са поставени в „${fallbackCategory.name}“` : ""}${skippedDuplicates ? ` · пропуснати ${skippedDuplicates} дубликата` : ""}${skippedByLimit ? ` · ${skippedByLimit} над FREE лимита` : ""}.`);
    announceToast(t("Сайтовете са импортнати"));
    void loadData(true);
  }

  async function submitSite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const details = cleanHttpUrl(siteDraft.url);
    if (!details) return setSiteError("Въведи валиден адрес, например https://youtube.com.");
    if (!editingSite && !subscription.isPro && siteItems.length >= FREE_SITE_LIMIT) {
      openUpgradeDialog("Достигна лимита на безплатния план. Стани PRO за неограничени сайтове.");
      return setSiteError("Безплатният план включва до 30 сайта.");
    }
    const name = siteDraft.name.trim() || details.domain;
    const description = cleanDescription(siteDraft.description);
    if (!siteDraft.categoryId) return setSiteError("Избери категория.");
    const payload = { name, url: details.url, domain: details.domain, description: description || null, category_id: siteDraft.categoryId, favicon_url: detectedFavicon ?? faviconFor(details.url), is_favorite: siteDraft.favorite, open_in_new_tab: siteDraft.openInNewTab };
    const wasNew = !editingSite;
    setSiteBusy(true);
    setSiteError("");
    const result = editingSite
      ? await supabase.from("sites").update(payload).eq("id", editingSite.id).select("id,name,url,domain,description,favicon_url,custom_icon_url,is_favorite,position,open_in_new_tab,category_id,visit_count,last_opened_at").single()
      : await supabase.from("sites").insert({ ...payload, user_id: session.user.id, position: (siteItems.filter((site) => site.categoryId === siteDraft.categoryId).length + 1) * 100 }).select("id,name,url,domain,description,favicon_url,custom_icon_url,is_favorite,position,open_in_new_tab,category_id,visit_count,last_opened_at").single();
    if (result.error || !result.data) {
      setSiteBusy(false);
      return setSiteError("Записването не успя. Опитай отново.");
    }
    let saved = asSite(result.data as Record<string, unknown>);
    const previousIconPath = storedIconPath(editingSite?.customIconUrl ?? null);
    try {
      if (siteIconFile) {
        const customIconUrl = await uploadSiteIcon(siteIconFile, saved.id);
        saved = { ...saved, customIconUrl };
        if (previousIconPath) void supabase.storage.from("site-icons").remove([previousIconPath]);
      } else if (removeCustomIcon && editingSite?.customIconUrl) {
        const iconUpdate = await supabase.from("sites").update({ custom_icon_url: null }).eq("id", saved.id);
        if (iconUpdate.error) throw iconUpdate.error;
        saved = { ...saved, customIconUrl: null };
        if (previousIconPath) void supabase.storage.from("site-icons").remove([previousIconPath]);
      }
    } catch {
      setSiteBusy(false);
      setEditingSite(saved);
      setSiteItems((items) => items.some((site) => site.id === saved.id) ? items.map((site) => site.id === saved.id ? saved : site) : [...items, saved]);
      return setSiteError("Сайтът е запазен, но собствената икона не беше качена. Провери SQL настройката за икони и опитай отново.");
    }
    setSiteBusy(false);
    setSiteItems((items) => wasNew ? [...items, saved] : items.map((site) => site.id === saved.id ? saved : site));
    closeSiteDialog();
    announceToast(t(wasNew ? "Сайтът е добавен" : "Сайтът е обновен"));
    if (wasNew) {
      setNewlyAddedSiteId(saved.id);
      window.setTimeout(() => {
        const element = document.querySelector(`[data-site-id="${saved.id}"]`) as HTMLElement | null;
        element?.scrollIntoView({ behavior: "smooth", block: "center" });
        element?.focus();
      }, 80);
      window.setTimeout(() => setNewlyAddedSiteId(null), 1700);
    }
  }

  function openSite(site: Site) {
    const now = new Date().toISOString();
    const nextVisitCount = site.visitCount + 1;
    setSiteItems((items) => items.map((item) => item.id === site.id ? { ...item, visitCount: nextVisitCount, lastOpenedAt: now } : item));
    void supabase?.from("sites").update({ visit_count: nextVisitCount, last_opened_at: now }).eq("id", site.id);
    if (isNativeApp()) {
      void openInNativeBrowser(site.url);
      return;
    }
    if (site.openInNewTab === false) window.location.assign(site.url);
    else window.open(site.url, "_blank", "noopener,noreferrer");
  }

  async function toggleFavorite(id: string) {
    if (!supabase) return;
    const site = siteItems.find((item) => item.id === id);
    if (!site) return;
    const nextFavorite = !site.favorite;
    setSiteItems((items) => items.map((item) => item.id === id ? { ...item, favorite: nextFavorite } : item));
    const { error } = await supabase.from("sites").update({ is_favorite: nextFavorite }).eq("id", id);
    if (error) {
      setSiteItems((items) => items.map((item) => item.id === id ? { ...item, favorite: site.favorite } : item));
      setDataError("Промяната в любимите не беше запазена. Опитай отново.");
    }
  }

  function focusSiteCard(id: string) {
    const element = document.querySelector(`[data-site-id="${id}"]`) as HTMLElement | null;
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
    element?.focus();
  }

  async function confirmDeleteSite() {
    if (!supabase || !deleteSiteTarget) return;
    const target = deleteSiteTarget;
    const { error } = await supabase.from("sites").delete().eq("id", target.id);
    if (error) return setDataError("Сайтът не беше изтрит. Опитай отново.");
    setSiteItems((items) => items.filter((site) => site.id !== target.id));
    setDeleteSiteTarget(null);
  }

  async function addCategory() {
    if (!supabase) return;
    if (!subscription.isPro && categories.length >= FREE_CATEGORY_LIMIT) {
      openUpgradeDialog("Безплатният план включва до 3 категории. Стани PRO за неограничени категории.");
      return;
    }
    const name = newCategoryName.trim();
    if (!name) return setCategoryError("Въведи име на категорията.");
    if (categories.some((category) => normalizedName(category.name) === normalizedName(name))) return setCategoryError("Вече има категория с това име.");
    setCategoryBusy(true);
    const result = await supabase.from("categories").insert({ user_id: session.user.id, name, icon: subscription.isPro ? newCategoryIcon.trim() || "🔖" : "🔖", tone: "blue", position: Math.max(0, ...categories.map((category) => category.position)) + 100 }).select("id,name,icon,tone,position,is_system").single();
    setCategoryBusy(false);
    if (result.error || !result.data) return setCategoryError("Категорията не беше добавена. Опитай отново.");
    const category = asCategory(result.data as Record<string, unknown>);
    setCategories((items) => [...items, category]);
    setCategoryDrafts((drafts) => ({ ...drafts, [category.id]: category.name }));
    setCategoryIconDrafts((drafts) => ({ ...drafts, [category.id]: category.icon }));
    setNewCategoryName("");
    setNewCategoryIcon("🔖");
    setCategoryError("");
  }

  async function commitCategory(id: string) {
    if (!supabase) return;
    const current = categories.find((category) => category.id === id);
    if (!current) return;
    const draftName = (categoryDrafts[id] ?? categoryDisplayName(current.name, language)).trim();
    const name = language === "en" && draftName === categoryDisplayName(current.name, "en") ? current.name : draftName;
    const icon = (categoryIconDrafts[id] ?? current.icon).trim() || "🔖";
    const duplicate = categories.some((category) => category.id !== id && normalizedName(category.name) === normalizedName(name));
    if (!name || duplicate) {
      setCategoryDrafts((drafts) => ({ ...drafts, [id]: current.name }));
      setCategoryIconDrafts((drafts) => ({ ...drafts, [id]: current.icon }));
      return setCategoryError(!name ? "Името на категорията не може да е празно." : "Вече има категория с това име.");
    }
    if (!subscription.isPro && icon !== current.icon) {
      setCategoryIconDrafts((drafts) => ({ ...drafts, [id]: current.icon }));
      openUpgradeDialog("Custom иконите за категории са налични с WebVault PRO.");
      return;
    }
    if (name === current.name && icon === current.icon) return;
    const { error } = await supabase.from("categories").update({ name, icon }).eq("id", id);
    if (error) {
      setCategoryDrafts((drafts) => ({ ...drafts, [id]: current.name }));
      setCategoryIconDrafts((drafts) => ({ ...drafts, [id]: current.icon }));
      return setCategoryError("Промяната не беше запазена. Опитай отново.");
    }
    setCategories((items) => items.map((category) => category.id === id ? { ...category, name, icon } : category));
    setCategoryError("");
  }

  async function changeCategoryTone(category: Category) {
    if (!supabase) return;
    if (!subscription.isPro) {
      openUpgradeDialog("Custom цветовете за категории са налични с WebVault PRO.");
      return;
    }
    const index = toneOrder.indexOf(category.tone);
    const tone = toneOrder[(index + 1 + toneOrder.length) % toneOrder.length];
    const { error } = await supabase.from("categories").update({ tone }).eq("id", category.id);
    if (error) return setCategoryError("Цветът не беше запазен. Опитай отново.");
    setCategories((items) => items.map((item) => item.id === category.id ? { ...item, tone } : item));
  }

  async function saveCategoryOrder(next: Category[]) {
    if (!supabase) return;
    setCategories(next);
    const results = await Promise.all(next.map((category, index) => supabase.from("categories").update({ position: (index + 1) * 100 }).eq("id", category.id)));
    if (results.some((result) => result.error)) {
      setCategoryError("Редът не беше запазен. Обнови страницата и опитай отново.");
      void loadData();
    }
  }

  function moveCategory(id: string, direction: -1 | 1) {
    const index = categories.findIndex((category) => category.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= categories.length) return;
    const next = [...categories];
    [next[index], next[target]] = [next[target], next[index]];
    void saveCategoryOrder(next);
  }

  function startCategoryDrag(event: ReactDragEvent<HTMLElement>, id: string) {
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/category", id);
    setDraggedCategory(id);
  }

  function dropCategory(targetId: string) {
    if (!draggedCategory || draggedCategory === targetId) return setDraggedCategory(null);
    const from = categories.findIndex((category) => category.id === draggedCategory);
    const to = categories.findIndex((category) => category.id === targetId);
    if (from >= 0 && to >= 0) {
      const next = [...categories];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      void saveCategoryOrder(next);
    }
    setDraggedCategory(null);
  }

  function startSiteDrag(event: ReactDragEvent<HTMLElement>, siteId: string) {
    if (siteOrderBusy) return;
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", siteId);
    setDraggedSiteId(siteId);
    setDropTargetSiteId(null);
  }

  async function moveSite(siteId: string, targetCategoryId: string, targetSiteId?: string) {
    if (!supabase || siteOrderBusy) return;
    const draggedSite = siteItems.find((site) => site.id === siteId);
    if (!draggedSite || (draggedSite.categoryId === targetCategoryId && targetSiteId === siteId)) return;
    const sourceSites = siteItems.filter((site) => site.categoryId === draggedSite.categoryId && site.id !== siteId).sort(byPosition);
    const targetBase = draggedSite.categoryId === targetCategoryId ? sourceSites : siteItems.filter((site) => site.categoryId === targetCategoryId && site.id !== siteId).sort(byPosition);
    const targetIndex = targetSiteId ? targetBase.findIndex((site) => site.id === targetSiteId) : -1;
    const targetSites = [...targetBase];
    targetSites.splice(targetIndex < 0 ? targetSites.length : targetIndex, 0, { ...draggedSite, categoryId: targetCategoryId });
    const changedSites = [
      ...(draggedSite.categoryId === targetCategoryId ? [] : sourceSites.map((site, index) => ({ id: site.id, categoryId: site.categoryId, position: (index + 1) * 100 }))),
      ...targetSites.map((site, index) => ({ id: site.id, categoryId: targetCategoryId, position: (index + 1) * 100 })),
    ];
    const changesById = new Map(changedSites.map((site) => [site.id, site]));
    setSiteOrderBusy(true);
    setSiteItems((sites) => sites.map((site) => {
      const change = changesById.get(site.id);
      return change ? { ...site, categoryId: change.categoryId, position: change.position } : site;
    }));
    setDraggedSiteId(null);
    setDropTargetSiteId(null);
    const results = await Promise.all(changedSites.map((site) => supabase.from("sites").update({ category_id: site.categoryId, position: site.position }).eq("id", site.id)));
    setSiteOrderBusy(false);
    if (results.some((result) => result.error)) {
      setDataError("Новият ред не беше запазен. Обнови страницата и опитай отново.");
      void loadData();
    }
  }

  function toggleCategoryCollapse(id: string) {
    setCollapsedCategories((items) => ({ ...items, [id]: !items[id] }));
  }

  function collapseAllCategories() {
    setCollapsedCategories(Object.fromEntries(categories.map((category) => [category.id, true])));
  }

  async function confirmDeleteCategory() {
    if (!supabase || !deleteCategoryTarget || deleteCategoryTarget.isSystem) return;
    const otherCategory = categories.find((category) => category.isSystem || category.name === "Други");
    if (!otherCategory) return setCategoryError("Не открихме категория „Други“. Обнови страницата и опитай отново.");
    const target = deleteCategoryTarget;
    setCategoryBusy(true);
    const moveResult = await supabase.from("sites").update({ category_id: otherCategory.id }).eq("category_id", target.id);
    const deleteResult = moveResult.error ? null : await supabase.from("categories").delete().eq("id", target.id);
    setCategoryBusy(false);
    if (moveResult.error || deleteResult?.error) return setDataError("Категорията не беше изтрита. Опитай отново.");
    setSiteItems((items) => items.map((site) => site.categoryId === target.id ? { ...site, categoryId: otherCategory.id } : site));
    setCategories((items) => items.filter((category) => category.id !== target.id));
    setDeleteCategoryTarget(null);
  }

  const showInitialEmpty = dataReady && !dataError && !siteItems.length && !query && searchFilter === "all";

  return (
    <main className={dark ? "app dark" : "app"}>
      <div className="ambient one" /><div className="ambient two" />
      <header className="topbar">
        <a className="brand" href="#top" aria-label="WebVault начало"><span className="brand-mark"><i /><i /><i /><i /></span><span><strong>WebVault</strong><small>{t("Всичко важно на едно място")}</small></span></a>
        <div className="header-actions">
          <div className="dashboard-language" aria-label={t("Език")}><button className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>EN</button><button className={language === "bg" ? "active" : ""} onClick={() => setLanguage("bg")}>BG</button></div>
          <DropdownMenu><DropdownMenuTrigger asChild><button className="icon-button" title={t("Настройки")} aria-label={t("Настройки")}><Settings2 size={19} /></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="header-menu"><DropdownMenuItem onSelect={openBackupManager} title={t("Изтегли backup")}><Download size={16} />{t("Backup и импорт")}</DropdownMenuItem><DropdownMenuItem onSelect={openBookmarkImport} title={t("Импорт на отметки")}><Upload size={16} />{t("Импорт на отметки")}</DropdownMenuItem><DropdownMenuItem onSelect={openInstallManager} title={t("Мобилен изглед")}><Smartphone size={16} />{t("Инсталирай приложението")}</DropdownMenuItem><DropdownMenuItem onSelect={() => setShowProfile(true)} title={t("Отвори настройките")}><UserCircle size={16} />{t("Профил и настройки")}</DropdownMenuItem><DropdownMenuItem onSelect={() => setDark((value) => !value)} title={t("Смени цветния режим")}>{dark ? <Sun size={16} /> : <Moon size={16} />}{t("Смени цветния режим")}</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => void signOut()} title={t("Изход")} className="danger-item"><LogOut size={16} />{t("Изход")}</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
          <Link className={subscription.isPro ? "pro-badge" : "go-pro"} href="/pricing" title={subscription.isPro ? t("PRO е активен") : t("Стани PRO")}>{subscription.isPro ? <><Crown size={14} />PRO</> : <><Crown size={15} />{t("Стани PRO")}</>}</Link>
          <button className="avatar" title={session.user.email ?? t("Профил")} aria-label={`${t("Профил")} ${displayName}`} onClick={() => setShowProfile(true)}>{avatarInitials(displayName)}</button>
        </div>
      </header>
      <div className="shell" id="top">
        <section className="intro"><div><span className="eyebrow"><Sparkles size={14} /> {t("Лично пространство")}</span><h1>{language === "en" ? `Good morning, ${displayName}.` : `Добро утро, ${displayName}.`}</h1><p>{t("Намери любимите си сайтове за секунди.")}</p></div><div className="primary-actions"><button className="category-button" onClick={openCategoryManager}><FolderPlus size={19} /><b>{t("Категории")}</b></button><button className="add-button" onClick={() => openAddSite()}><Plus size={20} /><b>{t("Добави сайт")}</b></button></div></section>
        <div className="search-area"><div className="search-wrap"><Search size={21} /><input ref={searchInputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Търси по име, адрес или категория…")} aria-label={t("Търси сайтове")} aria-controls="search-results" />{query && <button onClick={() => setQuery("")} aria-label={t("Изчисти")} title={t("Изчисти")}><X size={18} /></button>}<kbd>⌘ K</kbd></div><div className="search-filters" aria-label="Search filters"><button className={searchFilter === "all" ? "active" : ""} onClick={() => setSearchFilter("all")}><Check size={13} />{t("Всички")}</button><button className={searchFilter === "favorites" ? "active" : ""} onClick={() => setSearchFilter("favorites")}><Star size={13} />{t("Любими")}</button><button className={searchFilter === "recent" ? "active" : ""} onClick={() => setSearchFilter("recent")}><Clock3 size={13} />{t("Скорошни")}</button><button className={searchFilter === "visited" ? "active" : ""} onClick={() => setSearchFilter("visited")}><BarChart3 size={13} />{t("Най-посещавани")}</button></div><p className="search-hint">{t("Натисни K за търсене")}</p>{query.trim() && dataReady && <div className="search-results" id="search-results" role="listbox">{searchResultGroups.length ? searchResultGroups.map(({ category, items }) => <div className="search-result-group" key={category.id}><div className="search-result-heading"><span>{category.icon} {categoryLabels.get(category.id) ?? category.name}</span><small>{items.length}</small></div>{items.slice(0, 5).map((site) => <button className="search-result" key={site.id} onClick={() => focusSiteCard(site.id)} role="option" aria-selected="false"><SiteIcon site={site} /><span><strong><HighlightText text={site.name} query={query} /></strong><small><HighlightText text={site.domain} query={query} /></small></span><ExternalLink size={14} /></button>)}</div>) : <div className="search-no-results">{t("Няма намерени сайтове")}</div>}</div>}</div>
        {!dataReady && <div className="dashboard-state"><LoaderCircle size={22} className="spin" /> {t("Зареждаме твоите сайтове…")}</div>}
        {dataError && <div className="dashboard-state error"><p>{dataError}</p><button className="cancel" onClick={() => void loadData()}>{t("Опитай отново")}</button></div>}
        {dataReady && !dataError && <>{!query && searchFilter === "all" && favoriteSites.length > 0 && <SiteSection title={t("Любими")} icon="★" tone="favorite" sites={favoriteSites} t={t} onOpenSite={openSite} onToggleFavorite={toggleFavorite} onEdit={openEditSite} onDelete={setDeleteSiteTarget} highlightQuery={normalizedQuery} newlyAddedSiteId={newlyAddedSiteId} />}{!showInitialEmpty && groups.map(({ category, items }, index) => <SiteSection key={category.id} title={categoryLabels.get(category.id) ?? category.name} icon={category.icon} tone={category.tone} sites={items} t={t} category={category} isFirst={index === 0} isLast={index === groups.length - 1} collapsed={Boolean(collapsedCategories[category.id])} draggedCategoryId={draggedCategory} onManage={openCategoryManager} onMove={moveCategory} onDeleteCategory={setDeleteCategoryTarget} onChangeTone={() => void changeCategoryTone(category)} onCollapseAll={collapseAllCategories} onToggleCollapse={() => toggleCategoryCollapse(category.id)} onCategoryDragStart={startCategoryDrag} onCategoryDrop={dropCategory} onAddSite={openAddSite} onOpenSite={openSite} onToggleFavorite={toggleFavorite} onEdit={openEditSite} onDelete={setDeleteSiteTarget} draggedSiteId={draggedSiteId} dropTargetSiteId={dropTargetSiteId} siteOrderBusy={siteOrderBusy} onStartSiteDrag={startSiteDrag} onSiteDragOver={setDropTargetSiteId} onMoveSite={moveSite} onEndSiteDrag={() => { setDraggedSiteId(null); setDropTargetSiteId(null); }} highlightQuery={normalizedQuery} newlyAddedSiteId={newlyAddedSiteId} />)}{showInitialEmpty && <section className="onboarding">
          <div className="onboarding-head">
            <span className="onboarding-mark"><Sparkles size={22} /></span>
            <div><h2>{t("Добре дошъл в WebVault")}</h2><p>{t("Пренеси отметките си, разгледай примерна колекция или започни от нулата.")}</p></div>
          </div>
          <div className="onboarding-options">
            <button className="onboarding-option" onClick={openBookmarkImport}><span className="onboarding-icon"><Globe2 size={21} /></span><span><strong>{t("Импорт от Chrome")}</strong><small>{t("Качи HTML файл с отметки и запази папките.")}</small></span></button>
            <button className="onboarding-option" onClick={openSampleCollection}><span className="onboarding-icon sample"><Sparkles size={21} /></span><span><strong>{t("Опитай примерна колекция")}</strong><small>{t("Прегледай подредено табло, преди да добавиш своите сайтове.")}</small></span></button>
            <button className="onboarding-option" onClick={() => openAddSite()}><span className="onboarding-icon manual"><Plus size={21} /></span><span><strong>{t("Започни от нулата")}</strong><small>{t("Добави първия си сайт ръчно.")}</small></span></button>
          </div>
          <div className="onboarding-assurance"><span><Check size={15} />{t("Данните ти са твои — можеш да ги експортираш по всяко време.")}</span><span><Globe2 size={15} />{t(subscription.isPro ? "Синхронизацията е активна на всички твои устройства." : "Записите се пазят в личния ти акаунт. PRO ги синхронизира на всички устройства.")}</span></div>
        </section>}{!showInitialEmpty && !groups.some(({ items }) => items.length) && <div className="empty"><Search size={26} /><h2>{t("Няма намерени сайтове")}</h2><p>{t("Опитай с друго име, адрес или категория.")}</p></div>}</>}
        <footer><span>WebVault</span><span>{siteItems.length} {t("запазени сайта")} · {categories.length} {t("категории")}</span></footer>
      </div>
      {toastMessage && <div className="toast" role="status">{toastMessage}</div>}
      <UpgradeModal open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog} reason={upgradeReason} language={language} />
      <Dialog open={showSiteDialog} onOpenChange={(open) => open ? setShowSiteDialog(true) : closeSiteDialog()}>
        <DialogContent className="dialog-panel">
          <DialogHeader className="dialog-heading">
            <span className="modal-icon">{editingSite ? <Pencil size={19} /> : <Plus size={20} />}</span>
            <div>
              <DialogTitle>{editingSite ? t("Редактирай сайт") : t("Добави нов сайт")}</DialogTitle>
              <DialogDescription>{editingSite ? t("Промените и иконата ще се обновят веднага.") : t("Иконата на сайта ще се добави автоматично, когато е налична.")}</DialogDescription>
            </div>
          </DialogHeader>
          <form onSubmit={submitSite}>
            <label>{t("Адрес")}
              <input value={siteDraft.url} onChange={(event) => { setSiteDraft((draft) => ({ ...draft, url: event.target.value })); metadataFetchedForRef.current = ""; }} onBlur={() => void fetchMetadataForUrl(siteDraft.url)} onPaste={(event) => { const pastedValue = event.clipboardData.getData("text"); window.setTimeout(() => void fetchMetadataForUrl(pastedValue), 0); }} placeholder="https://youtube.com" inputMode="url" required />
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
