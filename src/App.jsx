import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  BarChart3,
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Link2,
  LogIn,
  LogOut,
  Plus,
  RefreshCcw,
  Target,
  Trash2,
  Users,
  Sparkles,
  LayoutDashboard,
  PanelsTopLeft,
  ListTodo,
  SlidersHorizontal,
  X,
  Search,
} from "lucide-react";

const STORAGE_KEYS = {
  content: "cm_app_content_shared_easy_v2",
  tasks: "cm_app_tasks_shared_easy_v2",
  workspaces: "cm_app_workspaces_shared_easy_v2",
  settings: "cm_app_settings_shared_easy_v2",
  activity: "cm_app_activity_shared_easy_v2",
};

const CLOUD_TABLE = "cm_shared_boards";

// Dejá estos datos fijos UNA sola vez y después la app ya no los vuelve a pedir.
// Si los dejás vacíos, la app funciona en modo local.
const FIXED_CLOUD_CONFIG = {
  url: "",
  anonKey: "",
  boardCode: "ANDREA-MARISOL-CM",
  boardTitle: "Tablero compartido Andrea y Marisol",
};

const defaultContent = [
  {
    id: 1,
    mesa: "Master Class",
    nombre: "Reel lanzamiento evento",
    fecha: "2026-03-02",
    hora: "10:00",
    red: "Instagram",
    tipo: "Reel",
    objetivo: "Alcance",
    campana: "Escenarios que Venden",
    estado: "Programado",
    link: "https://",
    alcance: 0,
    impresiones: 0,
    visualizaciones: 0,
    likes: 0,
    comentarios: 0,
    compartidos: 0,
    guardados: 0,
    respuestas: 0,
    clicks: 0,
    seguidores: 0,
  },
];

const defaultTasks = [
  { id: 1, tarea: "Diseñar piezas de la semana", prioridad: "Alta", mesa: "Master Class", estado: "En curso" },
];

const defaultWorkspaces = ["Master Class"];

const defaultActivity = [
  {
    id: 1,
    user: "Sistema",
    action: "Base creada",
    detail: "Se cargó la demo inicial",
    timestamp: new Date().toISOString(),
  },
];

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "contenido", label: "Contenido", icon: PanelsTopLeft },
  { id: "calendario", label: "Calendario", icon: CalendarDays },
  { id: "equipo", label: "Equipo", icon: ListTodo },
  { id: "ajustes", label: "Ajustes", icon: SlidersHorizontal },
];

function readStorage(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveStorage(key, value) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function createLogEntry(user, action, detail) {
  return {
    id: Date.now() + Math.floor(Math.random() * 1000),
    user,
    action,
    detail,
    timestamp: new Date().toISOString(),
  };
}

function calcInteractions(item) {
  return item.likes + item.comentarios + item.compartidos + item.guardados + item.respuestas + item.clicks;
}

function calcER(item) {
  if (!item.alcance) return 0;
  return (calcInteractions(item) / item.alcance) * 100;
}

function getMetricStatus(item) {
  const er = calcER(item);
  if (!item.alcance) return { label: "Sin datos", tone: "default" };
  if (er >= 8) return { label: "Buena", tone: "success" };
  if (er >= 4) return { label: "Regular", tone: "warning" };
  return { label: "Mala", tone: "danger" };
}

function getFormatFocusLabel(format) {
  if (format === "Historia") return "Clics + respuestas";
  if (format === "Reel") return "Guardados + compartidos";
  if (format === "Carrusel") return "Guardados";
  if (format === "Anuncio") return "Clics";
  return "Interacción general";
}

function getMetricExplanation(item) {
  const status = getMetricStatus(item).label;
  const interactions = calcInteractions(item);
  const er = calcER(item);
  const saves = item.guardados + item.compartidos;
  const conversation = item.comentarios + item.respuestas;

  if (!item.alcance) {
    return "Todavía no hay datos cargados. Apenas completes alcance e interacciones, la app te va a explicar si el rendimiento acompaña bien al formato.";
  }

  if (item.tipo === "Historia") {
    if (status === "Buena") return `Es buena porque en una historia pesan mucho la respuesta rápida y el clic. Acá tenés ${conversation} señales de conversación y ${item.clicks} clics, con un ER de ${er.toFixed(2)}%.`;
    if (status === "Regular") return `Es regular porque la historia tuvo algo de movimiento, pero para este formato conviene empujar más respuesta directa o clic. Hoy suma ${conversation} interacciones conversacionales.`;
    return `Es baja para una historia porque este formato necesita reacción inmediata. Con ${item.clicks} clics y ${conversation} respuestas/comentarios, quedó corta frente al alcance logrado.`;
  }

  if (item.tipo === "Reel") {
    if (status === "Buena") return `Es buena porque el reel no solo llegó, también generó acción. Entre guardados y compartidos suma ${saves}, que es una señal fuerte para contenido de descubrimiento.`;
    if (status === "Regular") return `Es regular porque el reel tuvo visibilidad, pero le falta más guardado o compartido para volverse fuerte. Hoy acumula ${saves} señales de valor.`;
    return `Es baja para un reel porque este formato suele rendir mejor cuando dispara alcance con guardados o compartidos. Acá esas señales quedaron en ${saves}.`;
  }

  if (item.tipo === "Carrusel") {
    if (status === "Buena") return `Es buena porque un carrusel suele medirse muy bien por guardados y compartidos. Acá consiguió ${saves}, lo que indica valor útil o digno de revisar después.`;
    if (status === "Regular") return `Es regular porque el carrusel tuvo lectura, pero para destacarse más debería empujar guardados o compartidos. Por ahora junta ${saves}.`;
    return `Es baja para un carrusel porque este formato necesita ser guardable o compartible. Con ${saves} señales de valor, todavía no terminó de sostener el rendimiento.`;
  }

  if (item.tipo === "Anuncio") {
    if (status === "Buena") return `Es buena porque en un anuncio pesan mucho los clics y la acción concreta. Acá logró ${item.clicks} clics, lo que acompaña bien el objetivo.`;
    if (status === "Regular") return `Es regular porque el anuncio tiene movimiento, pero todavía le falta un poco más de clic efectivo. Hoy registró ${item.clicks} clics.`;
    return `Es baja para un anuncio porque este formato debería convertir mejor en clics o respuesta directa, y hoy solo registra ${item.clicks} clics.`;
  }

  if (status === "Buena") return `Es buena porque el contenido no solo llegó, también consiguió ${interactions} interacciones reales. Para este formato, eso acompaña bien el objetivo cargado.`;
  if (status === "Regular") return `Es regular porque el contenido funciona, pero todavía no convierte su alcance en interacción fuerte. Lleva ${interactions} interacciones totales.`;
  return `Es baja porque el alcance no se tradujo en suficiente reacción. Hoy suma ${interactions} interacciones, que quedó corto para este tipo de pieza.`;
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildDateTime(fecha, hora = "00:00") {
  if (!fecha) return null;
  return new Date(`${fecha}T${hora || "00:00"}:00`);
}

function sameMonth(dateA, dateB) {
  return dateA.getMonth() === dateB.getMonth() && dateA.getFullYear() === dateB.getFullYear();
}

function getCalendarDays(baseDate) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const startDate = new Date(year, month, 1 - startOffset);

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    return d;
  });
}

function StatCard({ icon: Icon, title, value, hint, onClick, active = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-[28px] border p-5 shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl transition duration-300 ${
        active
          ? "border-fuchsia-400/30 bg-[linear-gradient(135deg,rgba(168,85,247,0.18),rgba(255,255,255,0.04)_28%,rgba(255,255,255,0.02)_100%)]"
          : "border-white/10 bg-[linear-gradient(135deg,rgba(168,85,247,0.12),rgba(255,255,255,0.03)_28%,rgba(255,255,255,0.02)_100%)] hover:-translate-y-0.5 hover:border-white/20"
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-zinc-400">{title}</span>
        <div className="rounded-2xl border border-white/10 bg-white/10 p-2">
          <Icon className="h-4 w-4 text-zinc-200" />
        </div>
      </div>
      <div className="text-2xl font-semibold tracking-tight text-white">{value}</div>
      <div className="mt-1 text-xs text-zinc-500">{hint}</div>
    </button>
  );
}

function Badge({ children, tone = "default" }) {
  const tones = {
    default: "bg-white/[0.08] text-zinc-200 border-white/10",
    success: "bg-emerald-500/15 text-emerald-300 border-emerald-400/20",
    warning: "bg-amber-500/15 text-amber-300 border-amber-400/20",
    danger: "bg-rose-500/15 text-rose-300 border-rose-400/20",
    info: "bg-sky-500/15 text-sky-300 border-sky-400/20",
    premium: "bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-400/20",
  };

  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium tracking-wide ${tones[tone]}`}>{children}</span>;
}

function SummaryCard({ title, total, er, pieces, subtitle }) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(168,85,247,0.14),rgba(255,255,255,0.03))] p-4 shadow-[0_10px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <div className="text-sm font-medium text-zinc-200">{title}</div>
      <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-zinc-500">{subtitle}</div>
      <div className="mt-3 grid gap-2 text-sm text-zinc-400">
        <div className="flex items-center justify-between">
          <span>Piezas</span>
          <span className="font-semibold text-white">{pieces}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Interacciones</span>
          <span className="font-semibold text-white">{total.toLocaleString("es-AR")}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>ER promedio</span>
          <span className="font-semibold text-white">{er.toFixed(2)}%</span>
        </div>
      </div>
    </div>
  );
}

function SafeOption({ children, value }) {
  return (
    <option value={value ?? children} style={{ color: "#111827", backgroundColor: "#f5f5f5" }}>
      {children}
    </option>
  );
}

function SectionCard({ title, subtitle, actions, children }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] p-5 shadow-[0_14px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-white">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-zinc-400">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export default function App() {
  const [content, setContent] = useState(() => readStorage(STORAGE_KEYS.content, defaultContent));
  const [tasks, setTasks] = useState(() => readStorage(STORAGE_KEYS.tasks, defaultTasks));
  const [workspaces, setWorkspaces] = useState(() => readStorage(STORAGE_KEYS.workspaces, defaultWorkspaces));
  const [activity, setActivity] = useState(() => readStorage(STORAGE_KEYS.activity, defaultActivity));

  const storedSettings = readStorage(STORAGE_KEYS.settings, {
    notifiedIds: [],
    activeUser: "",
    sessionActive: false,
    activeTab: "dashboard",
  });

  const [activeTab, setActiveTab] = useState(storedSettings.activeTab || "dashboard");
  const [workspaceFilter, setWorkspaceFilter] = useState("Todas");
  const [networkFilter, setNetworkFilter] = useState("Todas");
  const [searchTerm, setSearchTerm] = useState("");
  const [showItemModal, setShowItemModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [newWorkspace, setNewWorkspace] = useState("");
  const [activeUser, setActiveUser] = useState(storedSettings.activeUser || "");
  const [sessionActive, setSessionActive] = useState(Boolean(storedSettings.sessionActive));
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [notifiedIds, setNotifiedIds] = useState(storedSettings.notifiedIds || []);

  const [cloudClient, setCloudClient] = useState(null);
  const [cloudStatus, setCloudStatus] = useState(FIXED_CLOUD_CONFIG.url && FIXED_CLOUD_CONFIG.anonKey ? "Pendiente" : "Modo local");
  const [cloudError, setCloudError] = useState("");
  const [lastCloudSync, setLastCloudSync] = useState("");

  const realtimeChannelRef = useRef(null);
  const notifiedRef = useRef(notifiedIds);

  const boardCode = FIXED_CLOUD_CONFIG.boardCode || "ANDREA-MARISOL-CM";
  const boardTitle = FIXED_CLOUD_CONFIG.boardTitle || "Tablero compartido";

  const [newItem, setNewItem] = useState({
    mesa: defaultWorkspaces[0],
    nombre: "",
    fecha: formatDate(new Date()),
    hora: "10:00",
    red: "Instagram",
    tipo: "Post",
    objetivo: "Alcance",
    campana: "",
    estado: "Programado",
    link: "https://",
  });

  const [newTask, setNewTask] = useState({
    tarea: "",
    prioridad: "Media",
    mesa: defaultWorkspaces[0],
    estado: "Pendiente",
  });

  useEffect(() => saveStorage(STORAGE_KEYS.content, content), [content]);
  useEffect(() => saveStorage(STORAGE_KEYS.tasks, tasks), [tasks]);
  useEffect(() => saveStorage(STORAGE_KEYS.workspaces, workspaces), [workspaces]);
  useEffect(() => saveStorage(STORAGE_KEYS.activity, activity), [activity]);

  useEffect(() => {
    notifiedRef.current = notifiedIds;
    saveStorage(STORAGE_KEYS.settings, { notifiedIds, activeUser, sessionActive, activeTab });
  }, [notifiedIds, activeUser, sessionActive, activeTab]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    setNotificationEnabled(window.Notification.permission === "granted");
  }, []);

  useEffect(() => {
    if (cloudClient) return;
    if (!FIXED_CLOUD_CONFIG.url || !FIXED_CLOUD_CONFIG.anonKey) return;

    try {
      const client = createClient(FIXED_CLOUD_CONFIG.url.trim(), FIXED_CLOUD_CONFIG.anonKey.trim());
      setCloudClient(client);
      setCloudStatus("Nube lista");
    } catch (error) {
      setCloudClient(null);
      setCloudStatus("Modo local");
      setCloudError(error?.message || "No se pudo preparar la nube.");
    }
  }, [cloudClient]);

  const mesas = useMemo(() => ["Todas", ...workspaces], [workspaces]);

  const safeCurrentWorkspace = useMemo(() => {
    if (workspaceFilter === "Todas") return "Todas";
    return workspaces.includes(workspaceFilter) ? workspaceFilter : "Todas";
  }, [workspaceFilter, workspaces]);

  const filteredContent = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return content.filter((item) => {
      const mesaOk = safeCurrentWorkspace === "Todas" || item.mesa === safeCurrentWorkspace;
      const networkOk = networkFilter === "Todas" || item.red === networkFilter;
      const searchOk =
        !term ||
        [item.nombre, item.campana, item.mesa, item.red, item.tipo, item.objetivo, item.estado, item.link]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      return mesaOk && networkOk && searchOk;
    });
  }, [content, safeCurrentWorkspace, networkFilter, searchTerm]);

  const filteredTasks = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return tasks.filter((task) => {
      const mesaOk = safeCurrentWorkspace === "Todas" || task.mesa === safeCurrentWorkspace;
      const searchOk = !term || [task.tarea, task.mesa, task.estado, task.prioridad].some((value) => String(value).toLowerCase().includes(term));
      return mesaOk && searchOk;
    });
  }, [tasks, safeCurrentWorkspace, searchTerm]);

  const totals = useMemo(() => {
    const totalAlcance = filteredContent.reduce((sum, i) => sum + i.alcance, 0);
    const totalInteractions = filteredContent.reduce((sum, i) => sum + calcInteractions(i), 0);
    const avgER = filteredContent.length ? filteredContent.reduce((sum, i) => sum + calcER(i), 0) / filteredContent.length : 0;
    return {
      piezas: filteredContent.length,
      totalAlcance,
      totalInteractions,
      avgER,
    };
  }, [filteredContent]);

  const operationalSummary = useMemo(() => {
    return {
      publicados: filteredContent.filter((i) => i.estado === "Publicado").length,
      editados: filteredContent.filter((i) => i.estado === "Editado").length,
      editando: filteredContent.filter((i) => i.estado === "Editando").length,
      programados: filteredContent.filter((i) => i.estado === "Programado").length,
    };
  }, [filteredContent]);

  const piecePerformance = useMemo(() => {
    return [...filteredContent]
      .map((item) => ({
        id: item.id,
        nombre: item.nombre,
        mesa: item.mesa,
        tipo: item.tipo,
        red: item.red,
        estado: getMetricStatus(item),
        interactions: calcInteractions(item),
        er: calcER(item),
        explanation: getMetricExplanation(item),
      }))
      .filter((item) => item.er > 0 || item.interactions > 0)
      .sort((a, b) => {
        const erDiff = b.er - a.er;
        if (erDiff !== 0) return erDiff;
        return b.interactions - a.interactions;
      })
      .slice(0, 6);
  }, [filteredContent]);

  const topPerformer = useMemo(() => {
    if (!filteredContent.length) return null;
    return [...filteredContent].sort((a, b) => {
      const erDiff = calcER(b) - calcER(a);
      if (erDiff !== 0) return erDiff;
      return calcInteractions(b) - calcInteractions(a);
    })[0];
  }, [filteredContent]);

  const calendarDays = useMemo(() => getCalendarDays(calendarDate), [calendarDate]);
  const todayString = formatDate(new Date());

  const itemsByDate = useMemo(() => {
    const map = {};
    filteredContent.forEach((item) => {
      if (!item.fecha) return;
      if (!map[item.fecha]) map[item.fecha] = [];
      map[item.fecha].push(item);
    });
    return map;
  }, [filteredContent]);

  const upcomingAlerts = useMemo(() => {
    const now = new Date();
    return filteredContent
      .filter((item) => item.estado === "Programado")
      .map((item) => {
        const date = buildDateTime(item.fecha, item.hora);
        if (!date) return null;
        const diffMin = Math.round((date.getTime() - now.getTime()) / 60000);
        return { ...item, diffMin };
      })
      .filter(Boolean)
      .filter((item) => item.diffMin <= 60 && item.diffMin >= -180)
      .sort((a, b) => a.diffMin - b.diffMin);
  }, [filteredContent]);

  function addActivity(action, detail, user = activeUser || "Invitada") {
    setActivity((prev) => [createLogEntry(user, action, detail), ...prev].slice(0, 40));
  }

  function getSnapshot() {
    return {
      content,
      tasks,
      workspaces,
      activity,
      updatedBy: activeUser || "Invitada",
      updatedAt: new Date().toISOString(),
    };
  }

  function applySnapshot(snapshot, sourceLabel = "Nube") {
    if (!snapshot) return;
    if (Array.isArray(snapshot.content)) setContent(snapshot.content);
    if (Array.isArray(snapshot.tasks)) setTasks(snapshot.tasks);
    if (Array.isArray(snapshot.workspaces)) setWorkspaces(snapshot.workspaces);
    if (Array.isArray(snapshot.activity)) setActivity(snapshot.activity);
    addActivity("Datos cargados", `Se aplicó un tablero desde ${sourceLabel}`, "Sistema");
  }

  async function ensureSharedBoardReady() {
    if (!cloudClient) return;

    setCloudError("");

    const { data, error } = await cloudClient
      .from(CLOUD_TABLE)
      .select("payload, updated_at")
      .eq("share_code", boardCode)
      .maybeSingle();

    if (error) {
      setCloudStatus("Error");
      setCloudError(error.message);
      return;
    }

    if (data?.payload) {
      applySnapshot(data.payload, "tablero compartido");
      setLastCloudSync(new Date(data.updated_at || new Date()).toLocaleString("es-AR"));
      setCloudStatus("Sincronizado");
      return;
    }

    const payload = getSnapshot();
    const created = await cloudClient.from(CLOUD_TABLE).upsert(
      {
        share_code: boardCode,
        title: boardTitle,
        payload,
        updated_by_name: activeUser || "Invitada",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "share_code" }
    );

    if (created.error) {
      setCloudStatus("Error");
      setCloudError(created.error.message);
      return;
    }

    setCloudStatus("Tablero listo");
    setLastCloudSync(new Date().toLocaleString("es-AR"));
  }

  async function startSimpleSession() {
    const cleanName = activeUser.trim();
    if (!cleanName) {
      setCloudError("Poné tu nombre para entrar.");
      return;
    }

    setSessionActive(true);
    setCloudError("");
    addActivity("Sesión iniciada", cleanName, "Sistema");

    if (cloudClient) {
      await ensureSharedBoardReady();
    } else {
      setCloudStatus(FIXED_CLOUD_CONFIG.url && FIXED_CLOUD_CONFIG.anonKey ? "Pendiente" : "Modo local");
    }
  }

  function endSimpleSession() {
    setSessionActive(false);
    addActivity("Sesión cerrada", activeUser || "Invitada", "Sistema");
  }

  async function pushToCloud(silent = false) {
    if (!cloudClient || !sessionActive) return;

    if (!silent) {
      setCloudError("");
      setCloudStatus("Sincronizando...");
    }

    const payload = getSnapshot();

    const { error } = await cloudClient.from(CLOUD_TABLE).upsert(
      {
        share_code: boardCode,
        title: boardTitle,
        payload,
        updated_by_name: activeUser || "Invitada",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "share_code" }
    );

    if (error) {
      setCloudStatus("Error");
      setCloudError(error.message);
      return;
    }

    const stamp = new Date().toLocaleString("es-AR");
    setLastCloudSync(stamp);
    setCloudStatus("Sincronizado");
    if (!silent) addActivity("Guardado compartido", `Cambios subidos (${stamp})`, "Sistema");
  }

  async function pullFromCloud(silent = false) {
    if (!cloudClient || !sessionActive) return;

    if (!silent) {
      setCloudError("");
      setCloudStatus("Actualizando...");
    }

    const { data, error } = await cloudClient
      .from(CLOUD_TABLE)
      .select("payload, updated_at")
      .eq("share_code", boardCode)
      .maybeSingle();

    if (error) {
      setCloudStatus("Error");
      setCloudError(error.message);
      return;
    }

    if (data?.payload) {
      applySnapshot(data.payload, "nube");
      setLastCloudSync(new Date(data.updated_at || new Date()).toLocaleString("es-AR"));
      setCloudStatus("Sincronizado");
      if (!silent) addActivity("Cambios actualizados", "Se bajaron los últimos cambios", "Sistema");
    }
  }

  useEffect(() => {
    if (!cloudClient || !sessionActive) return;

    const channel = cloudClient
      .channel(`cm-board-${boardCode}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: CLOUD_TABLE,
          filter: `share_code=eq.${boardCode}`,
        },
        () => {
          pullFromCloud(true);
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel;

    return () => {
      cloudClient.removeChannel(channel);
      realtimeChannelRef.current = null;
    };
  }, [cloudClient, sessionActive, boardCode]);

  useEffect(() => {
    if (!cloudClient || !sessionActive) return;
    const timeout = setTimeout(() => {
      pushToCloud(true);
    }, 900);
    return () => clearTimeout(timeout);
  }, [content, tasks, workspaces, cloudClient, sessionActive]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    const interval = window.setInterval(() => {
      const now = new Date();
      content.forEach((item) => {
        if (item.estado !== "Programado") return;
        const dt = buildDateTime(item.fecha, item.hora);
        if (!dt) return;
        const diffMin = Math.round((dt.getTime() - now.getTime()) / 60000);
        const shouldNotify = diffMin <= 15 && diffMin >= -5;
        const alreadyNotified = notifiedRef.current.includes(item.id);

        if (shouldNotify && !alreadyNotified) {
          if (window.Notification.permission === "granted") {
            new window.Notification("Recordatorio de publicación", {
              body: `${item.nombre} • ${item.mesa} • ${item.red} a las ${item.hora}`,
            });
          }
          setNotifiedIds((prev) => [...prev, item.id]);
        }
      });
    }, 30000);

    return () => window.clearInterval(interval);
  }, [content]);

  function closeItemModal() {
    setShowItemModal(false);
  }

  function closeTaskModal() {
    setShowTaskModal(false);
  }

  function handleAddItem(e) {
    e.preventDefault();
    if (!newItem.nombre || !newItem.fecha) return;

    const item = {
      id: Date.now(),
      ...newItem,
      alcance: 0,
      impresiones: 0,
      visualizaciones: 0,
      likes: 0,
      comentarios: 0,
      compartidos: 0,
      guardados: 0,
      respuestas: 0,
      clicks: 0,
      seguidores: 0,
    };

    setContent((prev) => [item, ...prev]);
    addActivity("Nueva pieza", `${item.nombre} en ${item.mesa}`);
    setNewItem((prev) => ({
      ...prev,
      mesa: workspaces[0] || "General",
      nombre: "",
      fecha: formatDate(new Date()),
      hora: "10:00",
      campana: "",
      link: "https://",
      estado: "Programado",
    }));
    closeItemModal();
    setActiveTab("contenido");
  }

  function handleAddTask(e) {
    e.preventDefault();
    if (!newTask.tarea) return;
    const taskToAdd = { id: Date.now(), ...newTask };
    setTasks((prev) => [taskToAdd, ...prev]);
    addActivity("Nueva tarea", `${taskToAdd.tarea} • ${taskToAdd.mesa}`);
    setNewTask({
      tarea: "",
      prioridad: "Media",
      mesa: workspaces[0] || "General",
      estado: "Pendiente",
    });
    closeTaskModal();
    setActiveTab("equipo");
  }

  function addWorkspace() {
    const value = newWorkspace.trim();
    if (!value) return;
    if (workspaces.includes(value)) {
      setNewWorkspace("");
      return;
    }
    setWorkspaces((prev) => [...prev, value]);
    addActivity("Nueva mesa", value);
    setNewWorkspace("");
    setNewItem((prev) => ({ ...prev, mesa: value }));
    setNewTask((prev) => ({ ...prev, mesa: value }));
  }

  function removeWorkspace(name) {
    const fallbackMesa = workspaces.find((w) => w !== name) || "";

    setContent((prev) => prev.filter((item) => item.mesa !== name));
    setTasks((prev) => prev.filter((task) => task.mesa !== name));
    setWorkspaces((prev) => prev.filter((w) => w !== name));

    addActivity("Mesa eliminada", `${name} y sus datos asociados`);

    if (workspaceFilter === name) setWorkspaceFilter("Todas");

    setNewItem((prev) => ({
      ...prev,
      mesa: prev.mesa === name ? fallbackMesa : prev.mesa,
    }));

    setNewTask((prev) => ({
      ...prev,
      mesa: prev.mesa === name ? fallbackMesa : prev.mesa,
    }));
  }

  function updateMetric(id, field, value) {
    setContent((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: Number(value) || 0 } : item)));
  }

  function updateMetricWithLog(id, field, value) {
    updateMetric(id, field, value);
    const found = content.find((item) => item.id === id);
    if (!found) return;
    addActivity("Métrica actualizada", `${found.nombre} • ${field}`);
  }

  function updateField(id, field, value) {
    setContent((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }

  function updateFieldWithLog(id, field, value) {
    updateField(id, field, value);
    const found = content.find((item) => item.id === id);
    if (!found) return;
    addActivity("Contenido editado", `${found.nombre} • ${field}`);
  }

  function updateContentState(id, newState) {
    const found = content.find((item) => item.id === id);
    setContent((prev) => prev.map((item) => (item.id === id ? { ...item, estado: newState } : item)));
    if (found) addActivity("Estado actualizado", `${found.nombre} → ${newState}`);
  }

  function updateTaskStatus(id, newStatus) {
    const found = tasks.find((task) => task.id === id);
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, estado: newStatus } : task)));
    if (found) addActivity("Tarea actualizada", `${found.tarea} → ${newStatus}`);
  }

  async function enableNotifications() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const permission = await window.Notification.requestPermission();
    setNotificationEnabled(permission === "granted");
  }

  function resetDemoData() {
    setContent(defaultContent);
    setTasks(defaultTasks);
    setWorkspaces(defaultWorkspaces);
    setWorkspaceFilter("Todas");
    setNetworkFilter("Todas");
    setSearchTerm("");
    setNotifiedIds([]);
    setActivity([createLogEntry("Sistema", "Demo restablecida", "Se restauraron los datos base")]);
  }

  function renderDashboard() {
    return (
      <div className="space-y-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Users} title="Usuario activo" value={activeUser || "Sin nombre"} hint="Ir a ajustes" onClick={() => setActiveTab("ajustes")} active={activeTab === "ajustes"} />
          <StatCard icon={CalendarDays} title="Piezas" value={totals.piezas} hint="Abrir contenido" onClick={() => setActiveTab("contenido")} active={activeTab === "contenido"} />
          <StatCard icon={Target} title="Alcance total" value={totals.totalAlcance.toLocaleString("es-AR")} hint="Ver calendario" onClick={() => setActiveTab("calendario")} active={activeTab === "calendario"} />
          <StatCard icon={BarChart3} title="ER promedio" value={`${totals.avgER.toFixed(2)}%`} hint="Ver equipo" onClick={() => setActiveTab("equipo")} active={activeTab === "equipo"} />
        </div>

        <SectionCard
          title="Rendimiento por pieza"
          subtitle="Acá ves qué piezas rindieron mejor o peor, una por una, sin mezclar formatos."
          actions={
            <select value={networkFilter} onChange={(e) => setNetworkFilter(e.target.value)} className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-300 outline-none">
              <SafeOption>Todas</SafeOption>
              <SafeOption>Instagram</SafeOption>
              <SafeOption>Facebook</SafeOption>
              <SafeOption>TikTok</SafeOption>
              <SafeOption>LinkedIn</SafeOption>
            </select>
          }
        >
          {piecePerformance.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {piecePerformance.map((piece) => (
                <div key={piece.id} className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(168,85,247,0.14),rgba(255,255,255,0.03))] p-4 shadow-[0_10px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="premium">{piece.mesa}</Badge>
                    <Badge tone="info">{piece.red}</Badge>
                    <Badge>{piece.tipo}</Badge>
                    <Badge tone={piece.estado.tone}>{piece.estado.label}</Badge>
                  </div>
                  <div className="mt-3 text-sm font-semibold text-white">{piece.nombre}</div>
                  <div className="mt-3 grid gap-2 text-sm text-zinc-400">
                    <div className="flex items-center justify-between">
                      <span>Interacciones</span>
                      <span className="font-semibold text-white">{piece.interactions.toLocaleString("es-AR")}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>ER</span>
                      <span className="font-semibold text-white">{piece.er.toFixed(2)}%</span>
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-zinc-400">{piece.explanation}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-400">Todavía no hay suficientes datos para evaluar piezas individuales.</div>
          )}
        </SectionCard>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <SectionCard title="Mesas de trabajo" subtitle="Ambas personas manejan las mismas mesas del tablero compartido.">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <input value={newWorkspace} onChange={(e) => setNewWorkspace(e.target.value)} placeholder="Nueva mesa / cliente" className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-200 outline-none" />
              <button onClick={addWorkspace} className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-zinc-900">
                Agregar mesa
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {mesas.map((mesa) => (
                <div key={mesa} className="flex items-center gap-1">
                  <button
                    onClick={() => setWorkspaceFilter(mesa)}
                    className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${safeCurrentWorkspace === mesa ? "bg-white text-zinc-900" : "border border-white/10 bg-black/20 text-zinc-300"}`}
                  >
                    {mesa}
                  </button>
                  {mesa !== "Todas" && (
                    <button onClick={() => removeWorkspace(mesa)} title="Eliminar mesa y borrar también su contenido y tareas" className="rounded-xl border border-white/10 bg-black/20 p-2 text-zinc-400">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Lectura rápida" subtitle="Lo más útil para ver qué está funcionando hoy.">
            {topPerformer ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-300">Mejor pieza actual</div>
                  <div className="mt-2 text-lg font-semibold text-white">{topPerformer.nombre}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge tone="premium">{topPerformer.mesa}</Badge>
                    <Badge tone="info">{topPerformer.tipo}</Badge>
                    <Badge tone="success">{getMetricStatus(topPerformer).label}</Badge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-zinc-200">{getMetricExplanation(topPerformer)}</p>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 p-3"><span className="text-sm text-zinc-300">Publicado</span><Badge tone="success">{operationalSummary.publicados}</Badge></div>
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 p-3"><span className="text-sm text-zinc-300">Editado</span><Badge tone="info">{operationalSummary.editados}</Badge></div>
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 p-3"><span className="text-sm text-zinc-300">Editando</span><Badge tone="danger">{operationalSummary.editando}</Badge></div>
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 p-3"><span className="text-sm text-zinc-300">Programado</span><Badge tone="warning">{operationalSummary.programados}</Badge></div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-400">Todavía no hay piezas con datos suficientes para destacar una mejor.</div>
            )}
          </SectionCard>
        </div>
      </div>
    );
  }

  function renderContenido() {
    return (
      <SectionCard
        title="Control de contenido"
        subtitle="Planificación, calendario, estado y métricas por pieza."
        actions={
          <>
            <Badge tone="info">Activo: {activeUser || "Sin nombre"}</Badge>
            <Badge tone={cloudClient && sessionActive ? "success" : "warning"}>{cloudClient && sessionActive ? "Guardado compartido" : "Modo local"}</Badge>
          </>
        }
      >
        <div className="space-y-4">
          {filteredContent.map((item) => {
            const er = calcER(item);
            const interactions = calcInteractions(item);
            const metricStatus = getMetricStatus(item);
            const explanation = getMetricExplanation(item);

            return (
              <div key={item.id} className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(168,85,247,0.08),rgba(255,255,255,0.03)_35%,rgba(255,255,255,0.02)_100%)] p-4 shadow-[0_14px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl">
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <input value={item.nombre} onChange={(e) => updateFieldWithLog(item.id, "nombre", e.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-base font-semibold tracking-tight text-white outline-none md:min-w-[320px]" />
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="premium">{item.mesa}</Badge>
                      <Badge tone="info">{item.red}</Badge>
                      <Badge>{item.tipo}</Badge>
                      <Badge tone={item.estado === "Publicado" ? "success" : item.estado === "Programado" ? "warning" : item.estado === "Editando" ? "danger" : "info"}>{item.estado}</Badge>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Interacciones</div>
                      <div className="mt-1 text-lg font-semibold text-white">{interactions}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">ER</div>
                      <div className="mt-1 text-lg font-semibold text-white">{er.toFixed(2)}%</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Rendimiento</div>
                      <div className="mt-1"><Badge tone={metricStatus.tone}>{metricStatus.label}</Badge></div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Objetivo</div>
                      <div className="mt-1 text-sm font-medium text-zinc-200">{item.objetivo}</div>
                    </div>
                  </div>
                </div>

                <div className="mb-4 rounded-3xl border border-sky-400/20 bg-sky-500/10 p-4">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-300">Lectura de la métrica</div>
                  <div className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-zinc-400">Qué pesa más acá: {getFormatFocusLabel(item.tipo)}</div>
                  <p className="text-sm leading-6 text-zinc-100">{explanation}</p>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1.1fr_1.2fr]">
                  <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                    <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Datos base</div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <select value={item.mesa} onChange={(e) => updateFieldWithLog(item.id, "mesa", e.target.value)} className="rounded-2xl border border-white/10 bg-zinc-900/80 px-3 py-2 text-sm outline-none">
                        {workspaces.map((mesa) => (
                          <SafeOption key={mesa}>{mesa}</SafeOption>
                        ))}
                      </select>
                      <select value={item.estado} onChange={(e) => updateContentState(item.id, e.target.value)} className="rounded-2xl border border-white/10 bg-zinc-900/80 px-3 py-2 text-sm outline-none">
                        <SafeOption>Programado</SafeOption>
                        <SafeOption>Editando</SafeOption>
                        <SafeOption>Editado</SafeOption>
                        <SafeOption>Publicado</SafeOption>
                      </select>
                      <select value={item.red} onChange={(e) => updateFieldWithLog(item.id, "red", e.target.value)} className="rounded-2xl border border-white/10 bg-zinc-900/80 px-3 py-2 text-sm outline-none">
                        <SafeOption>Instagram</SafeOption>
                        <SafeOption>Facebook</SafeOption>
                        <SafeOption>TikTok</SafeOption>
                        <SafeOption>LinkedIn</SafeOption>
                      </select>
                      <select value={item.tipo} onChange={(e) => updateFieldWithLog(item.id, "tipo", e.target.value)} className="rounded-2xl border border-white/10 bg-zinc-900/80 px-3 py-2 text-sm outline-none">
                        <SafeOption>Post</SafeOption>
                        <SafeOption>Reel</SafeOption>
                        <SafeOption>Historia</SafeOption>
                        <SafeOption>Carrusel</SafeOption>
                        <SafeOption>Anuncio</SafeOption>
                      </select>
                      <input type="date" value={item.fecha} onChange={(e) => updateFieldWithLog(item.id, "fecha", e.target.value)} className="rounded-2xl border border-white/10 bg-zinc-900/80 px-3 py-2 text-sm outline-none" />
                      <input type="time" value={item.hora || "00:00"} onChange={(e) => updateFieldWithLog(item.id, "hora", e.target.value)} className="rounded-2xl border border-white/10 bg-zinc-900/80 px-3 py-2 text-sm outline-none" />
                      <select value={item.objetivo} onChange={(e) => updateFieldWithLog(item.id, "objetivo", e.target.value)} className="rounded-2xl border border-white/10 bg-zinc-900/80 px-3 py-2 text-sm outline-none md:col-span-2">
                        <SafeOption>Alcance</SafeOption>
                        <SafeOption>Interacción</SafeOption>
                        <SafeOption>Comunidad</SafeOption>
                        <SafeOption>Leads</SafeOption>
                        <SafeOption>Ventas</SafeOption>
                      </select>
                      <input value={item.campana} onChange={(e) => updateFieldWithLog(item.id, "campana", e.target.value)} className="rounded-2xl border border-white/10 bg-zinc-900/80 px-3 py-2 text-sm outline-none md:col-span-2" placeholder="Campaña" />
                      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-zinc-900/80 px-3 py-2 md:col-span-2">
                        <Link2 className="h-4 w-4 text-zinc-500" />
                        <input value={item.link} onChange={(e) => updateFieldWithLog(item.id, "link", e.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder="Link" />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                    <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Métricas</div>
                    <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-3 text-xs leading-5 text-zinc-300">
                      <span className="font-semibold text-amber-300">Guía rápida:</span> <span className="text-zinc-200">Alcance</span> = personas únicas que vieron la pieza. <span className="text-zinc-200">Impresiones</span> = cantidad total de veces que se mostró (puede contar repetidas). <span className="text-zinc-200">Likes</span> = reacciones de “me gusta”. No son lo mismo.
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {[
                        ["alcance", "Alcance"],
                        ["impresiones", "Impresiones"],
                        ["likes", "Likes"],
                        ["comentarios", "Comentarios"],
                        ["compartidos", "Compartidos"],
                        ["guardados", "Guardados"],
                        ["respuestas", "Respuestas"],
                        ["clicks", "Clicks"],
                      ].map(([field, label]) => (
                        <label key={field} className="block rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                          <span className="mb-1 block text-[11px] uppercase tracking-[0.18em] text-zinc-500">{label}</span>
                          <input type="number" value={item[field]} onChange={(e) => updateMetricWithLog(item.id, field, e.target.value)} className="w-full bg-transparent text-sm font-medium text-white outline-none" />
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
    );
  }

  function renderCalendario() {
    return (
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard title="Calendario" subtitle="Vista mensual de publicaciones programadas.">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button onClick={() => setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))} className="rounded-xl border border-white/10 bg-black/20 p-2">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="min-w-[120px] text-center text-sm font-medium text-zinc-200">{calendarDate.toLocaleDateString("es-AR", { month: "long", year: "numeric" })}</div>
              <button onClick={() => setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))} className="rounded-xl border border-white/10 bg-black/20 p-2">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="mb-2 grid grid-cols-7 gap-2 text-center text-[11px] uppercase tracking-wide text-zinc-500">
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((day) => {
              const dateKey = formatDate(day);
              const items = itemsByDate[dateKey] || [];
              const isCurrentMonth = sameMonth(day, calendarDate);
              const isToday = dateKey === todayString;

              return (
                <div key={dateKey} className={`min-h-[92px] rounded-2xl border p-2 ${isToday ? "border-amber-400/30 bg-amber-500/10" : isCurrentMonth ? "border-white/10 bg-black/20" : "border-white/5 bg-black/10"}`}>
                  <div className={`mb-2 text-xs font-medium ${isCurrentMonth ? "text-zinc-200" : "text-zinc-500"}`}>{day.getDate()}</div>
                  <div className="space-y-1">
                    {items.slice(0, 2).map((item) => (
                      <div key={item.id} className="rounded-xl bg-white/10 px-2 py-1 text-[10px] leading-4 text-zinc-200">
                        {item.hora} • {item.red}
                      </div>
                    ))}
                    {items.length > 2 && <div className="text-[10px] text-zinc-500">+{items.length - 2} más</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Recordatorios" subtitle="Avisos de publicaciones próximas según fecha y hora.">
            <div className="mb-4">
              <button onClick={enableNotifications} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-200">
                <Bell className="h-4 w-4" />
                {notificationEnabled ? "Notificaciones activas" : "Activar avisos"}
              </button>
            </div>
            <div className="space-y-3">
              {upcomingAlerts.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-zinc-400">No hay publicaciones próximas en la próxima hora.</div>
              ) : (
                upcomingAlerts.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-white">{item.nombre}</div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          <Badge>{item.mesa}</Badge>
                          <Badge tone="info">{item.red}</Badge>
                        </div>
                      </div>
                      <Badge tone={item.diffMin < 0 ? "danger" : "warning"}>{item.diffMin < 0 ? `Atrasado ${Math.abs(item.diffMin)} min` : `En ${item.diffMin} min`}</Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </SectionCard>

          <SectionCard title="Última actividad" subtitle="Cambios recientes del tablero.">
            <div className="space-y-3">
              {activity.slice(0, 5).map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="text-sm font-medium text-white">{entry.action}</div>
                  <div className="mt-1 text-xs text-zinc-400">{entry.detail}</div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    );
  }

  function renderEquipo() {
    return (
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard title="Tareas del equipo" subtitle="Ambas personas ven y editan las mismas tareas.">
          <div className="space-y-3">
            {filteredTasks.map((task) => (
              <div key={task.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-white">{task.tarea}</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Badge>{task.mesa}</Badge>
                      <Badge tone={task.prioridad === "Alta" ? "danger" : task.prioridad === "Media" ? "warning" : "info"}>{task.prioridad}</Badge>
                    </div>
                  </div>
                  <select value={task.estado} onChange={(e) => updateTaskStatus(task.id, e.target.value)} className="rounded-xl border border-white/10 bg-zinc-900 px-2 py-1 text-xs outline-none">
                    <SafeOption>Pendiente</SafeOption>
                    <SafeOption>En curso</SafeOption>
                    <SafeOption>Hecha</SafeOption>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Actividad reciente" subtitle="Movimientos del equipo en el tablero compartido.">
          <div className="space-y-3">
            {activity.slice(0, 8).map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-white">{entry.action}</div>
                    <div className="mt-1 text-xs text-zinc-400">{entry.detail}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-zinc-300">{entry.user}</div>
                    <div className="text-[11px] text-zinc-500">{new Date(entry.timestamp).toLocaleString("es-AR")}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    );
  }

  function renderAjustes() {
    return (
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title="Acceso simple" subtitle="La idea es que vos y Marisol solo entren con su nombre y trabajen. Nada de pegar URLs todos los días.">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge tone={cloudClient ? "success" : "warning"}>{cloudStatus}</Badge>
            <Badge tone={sessionActive ? "success" : "warning"}>{sessionActive ? "Sesión activa" : "Sin entrar"}</Badge>
            <Badge tone="info">{boardCode}</Badge>
            {lastCloudSync && <Badge tone="default">{lastCloudSync}</Badge>}
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <input value={activeUser} onChange={(e) => setActiveUser(e.target.value)} placeholder="Tu nombre" className="rounded-2xl border border-white/10 bg-zinc-900/80 px-3 py-3 text-sm text-zinc-200 outline-none" />
            {!sessionActive ? (
              <button onClick={startSimpleSession} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-zinc-900">
                <LogIn className="h-4 w-4" />
                Entrar
              </button>
            ) : (
              <button onClick={endSimpleSession} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-zinc-200">
                <LogOut className="h-4 w-4" />
                Salir
              </button>
            )}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
              <div className="mb-2 font-semibold text-white">Cómo debería sentirse</div>
              <p className="leading-6">Abrís la app, iniciás sesión y listo. Si la nube ya quedó fija por detrás, el tablero compartido se carga solo y todo lo que cambien ambas se guarda para las dos.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
              <div className="mb-2 font-semibold text-white">Qué pasa si hoy está local</div>
              <p className="leading-6">Si ves “Modo local”, la parte técnica todavía no quedó configurada una sola vez. La app sigue funcionando, pero cada navegador guarda por separado.</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={() => pullFromCloud(false)} disabled={!cloudClient || !sessionActive} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-sm font-semibold text-zinc-200 disabled:opacity-40">
              Actualizar cambios
            </button>
            <button onClick={() => pushToCloud(false)} disabled={!cloudClient || !sessionActive} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-sm font-semibold text-zinc-200 disabled:opacity-40">
              Guardar ahora
            </button>
          </div>

          {cloudError && <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-200">{cloudError}</div>}
        </SectionCard>

        <SectionCard title="Modo de trabajo" subtitle="Más simple y más parecido a una herramienta de uso diario.">
          <div className="space-y-3 text-sm leading-6 text-zinc-400">
            <p>• Ya no hace falta mostrar URL, anon key o códigos técnicos en pantalla para trabajar todos los días.</p>
            <p>• La nube queda fija por detrás una sola vez y después ustedes solo entran con su nombre.</p>
            <p>• El tablero compartido es uno solo, así ambas ven y modifican lo mismo.</p>
            <p>• Si una cambia algo, la otra lo ve cuando la nube está configurada.</p>
          </div>
          <button onClick={resetDemoData} className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-sm font-semibold text-zinc-200">
            <RefreshCcw className="h-4 w-4" />
            Restablecer demo
          </button>
        </SectionCard>
      </div>
    );
  }

  function renderActiveTab() {
    if (activeTab === "contenido") return <div>{renderContenido()}</div>;
    if (activeTab === "calendario") return <div>{renderCalendario()}</div>;
    if (activeTab === "equipo") return <div>{renderEquipo()}</div>;
    if (activeTab === "ajustes") return <div>{renderAjustes()}</div>;
    return <div>{renderDashboard()}</div>;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,0.16),transparent_28%),radial-gradient(circle_at_top_left,rgba(56,189,248,0.10),transparent_22%),linear-gradient(180deg,#050509_0%,#09090f_45%,#050509_100%)] text-zinc-100">
      <div className="mx-auto flex max-w-[1600px] gap-6 p-4 md:p-6">
        <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-[280px] shrink-0 rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(12,12,18,0.96),rgba(8,8,12,0.88))] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl xl:flex xl:flex-col">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
              <Sparkles className="h-3.5 w-3.5" />
              Panel CM premium
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Control premium</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-400">Más simple para usar todos los días y con lectura de métricas mucho más útil.</p>
          </div>

          <nav className="mt-8 space-y-2">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${active ? "bg-gradient-to-r from-fuchsia-400 to-violet-300 text-zinc-950 shadow-[0_10px_30px_rgba(168,85,247,0.25)]" : "border border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06]"}`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Sesión</div>
            <div className="mt-2 text-sm font-medium text-white">{activeUser || "Sin nombre"}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone={sessionActive ? "success" : "warning"}>{sessionActive ? "Activa" : "Pendiente"}</Badge>
              <Badge tone={cloudClient ? "info" : "default"}>{cloudClient ? cloudStatus : "Local"}</Badge>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 space-y-6">
          <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-6 shadow-2xl md:p-8">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-fuchsia-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 left-1/3 h-56 w-56 rounded-full bg-sky-500/10 blur-3xl" />
            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300 xl:hidden">
                  <Sparkles className="h-3.5 w-3.5" />
                  Panel CM premium
                </div>
                <h1 className="text-3xl font-semibold tracking-tight text-white md:text-5xl md:leading-[1.05]">
                  {TABS.find((tab) => tab.id === activeTab)?.label || "Dashboard"}
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400 md:text-[15px]">
                  Visual tipo app de pago, navegación lateral, buscador rápido y una forma de trabajo mucho menos engorrosa.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setShowItemModal(true)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-400 to-violet-300 px-4 py-2.5 text-sm font-semibold text-zinc-950 shadow-[0_10px_30px_rgba(168,85,247,0.28)] transition hover:scale-[1.02]"
                >
                  <Plus className="h-4 w-4" />
                  Nuevo contenido
                </button>

                <button onClick={() => setShowTaskModal(true)} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-zinc-200">
                  Nueva tarea
                </button>
              </div>
            </div>

            <div className="relative mt-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap gap-2 rounded-[24px] border border-white/10 bg-white/[0.03] p-2">
                {mesas.map((mesa) => {
                  const active = safeCurrentWorkspace === mesa;
                  return (
                    <button
                      key={mesa}
                      onClick={() => setWorkspaceFilter(mesa)}
                      className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${active ? "bg-gradient-to-r from-fuchsia-400 to-violet-300 text-zinc-950 shadow-[0_8px_24px_rgba(168,85,247,0.24)]" : "text-zinc-300 hover:bg-white/[0.06]"}`}
                    >
                      {mesa}
                    </button>
                  );
                })}
              </div>

              <div className="flex w-full max-w-xl items-center gap-3 rounded-[24px] border border-white/10 bg-black/20 px-4 py-3 backdrop-blur xl:w-[420px]">
                <Search className="h-4 w-4 text-zinc-500" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar contenido, cliente, campaña o tarea"
                  className="w-full bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-500"
                />
              </div>
            </div>
          </div>

          <div className="xl:hidden flex gap-2 overflow-x-auto pb-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium ${active ? "bg-gradient-to-r from-fuchsia-400 to-violet-300 text-zinc-950" : "border border-white/10 bg-white/[0.04] text-zinc-300"}`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {renderActiveTab()}
        </main>
      </div>

      
        {showItemModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
            <div className="w-full max-w-4xl rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(18,18,26,0.96),rgba(10,10,16,0.94))] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.45)]">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-zinc-300">
                    <Sparkles className="h-3.5 w-3.5" />
                    Modal premium
                  </div>
                  <h3 className="text-2xl font-semibold tracking-tight text-white">Crear contenido</h3>
                  <p className="mt-1 text-sm text-zinc-400">Carga rápida, limpia y separada del tablero principal.</p>
                </div>
                <button onClick={closeItemModal} className="rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-zinc-300">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleAddItem} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <select value={newItem.mesa} onChange={(e) => setNewItem((prev) => ({ ...prev, mesa: e.target.value }))} className="rounded-2xl border border-white/10 bg-zinc-900/80 px-3 py-3 text-sm outline-none">
                  {workspaces.map((mesa) => (
                    <SafeOption key={mesa}>{mesa}</SafeOption>
                  ))}
                </select>
                <input value={newItem.nombre} onChange={(e) => setNewItem((prev) => ({ ...prev, nombre: e.target.value }))} placeholder="Nombre del contenido" className="rounded-2xl border border-white/10 bg-zinc-900/80 px-3 py-3 text-sm outline-none xl:col-span-2" />
                <input type="date" value={newItem.fecha} onChange={(e) => setNewItem((prev) => ({ ...prev, fecha: e.target.value }))} className="rounded-2xl border border-white/10 bg-zinc-900/80 px-3 py-3 text-sm outline-none" />
                <input type="time" value={newItem.hora} onChange={(e) => setNewItem((prev) => ({ ...prev, hora: e.target.value }))} className="rounded-2xl border border-white/10 bg-zinc-900/80 px-3 py-3 text-sm outline-none" />
                <select value={newItem.red} onChange={(e) => setNewItem((prev) => ({ ...prev, red: e.target.value }))} className="rounded-2xl border border-white/10 bg-zinc-900/80 px-3 py-3 text-sm outline-none">
                  <SafeOption>Instagram</SafeOption>
                  <SafeOption>Facebook</SafeOption>
                  <SafeOption>TikTok</SafeOption>
                  <SafeOption>LinkedIn</SafeOption>
                </select>
                <select value={newItem.tipo} onChange={(e) => setNewItem((prev) => ({ ...prev, tipo: e.target.value }))} className="rounded-2xl border border-white/10 bg-zinc-900/80 px-3 py-3 text-sm outline-none">
                  <SafeOption>Post</SafeOption>
                  <SafeOption>Reel</SafeOption>
                  <SafeOption>Historia</SafeOption>
                  <SafeOption>Carrusel</SafeOption>
                  <SafeOption>Anuncio</SafeOption>
                </select>
                <select value={newItem.objetivo} onChange={(e) => setNewItem((prev) => ({ ...prev, objetivo: e.target.value }))} className="rounded-2xl border border-white/10 bg-zinc-900/80 px-3 py-3 text-sm outline-none">
                  <SafeOption>Alcance</SafeOption>
                  <SafeOption>Interacción</SafeOption>
                  <SafeOption>Comunidad</SafeOption>
                  <SafeOption>Leads</SafeOption>
                  <SafeOption>Ventas</SafeOption>
                </select>
                <select value={newItem.estado} onChange={(e) => setNewItem((prev) => ({ ...prev, estado: e.target.value }))} className="rounded-2xl border border-white/10 bg-zinc-900/80 px-3 py-3 text-sm outline-none">
                  <SafeOption>Programado</SafeOption>
                  <SafeOption>Editando</SafeOption>
                  <SafeOption>Editado</SafeOption>
                  <SafeOption>Publicado</SafeOption>
                </select>
                <input value={newItem.campana} onChange={(e) => setNewItem((prev) => ({ ...prev, campana: e.target.value }))} placeholder="Tema / campaña" className="rounded-2xl border border-white/10 bg-zinc-900/80 px-3 py-3 text-sm outline-none xl:col-span-2" />
                <input value={newItem.link} onChange={(e) => setNewItem((prev) => ({ ...prev, link: e.target.value }))} placeholder="Link de pieza" className="rounded-2xl border border-white/10 bg-zinc-900/80 px-3 py-3 text-sm outline-none xl:col-span-3" />

                <div className="mt-2 flex flex-wrap gap-3 xl:col-span-3">
                  <button type="button" onClick={closeItemModal} className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-zinc-200">
                    Cancelar
                  </button>
                  <button type="submit" className="rounded-2xl bg-gradient-to-r from-fuchsia-400 to-violet-300 px-5 py-3 text-sm font-semibold text-zinc-950 shadow-[0_10px_30px_rgba(168,85,247,0.28)]">
                    Guardar contenido
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      

      
        {showTaskModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
            <div className="w-full max-w-2xl rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(18,18,26,0.96),rgba(10,10,16,0.94))] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.45)]">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-zinc-300">
                    <Sparkles className="h-3.5 w-3.5" />
                    Modal premium
                  </div>
                  <h3 className="text-2xl font-semibold tracking-tight text-white">Crear tarea</h3>
                  <p className="mt-1 text-sm text-zinc-400">Rápida y limpia para el equipo.</p>
                </div>
                <button onClick={closeTaskModal} className="rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-zinc-300">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleAddTask} className="grid gap-4 md:grid-cols-2">
                <input value={newTask.tarea} onChange={(e) => setNewTask((prev) => ({ ...prev, tarea: e.target.value }))} placeholder="Nueva tarea" className="rounded-2xl border border-white/10 bg-zinc-900/80 px-3 py-3 text-sm outline-none md:col-span-2" />
                <select value={newTask.mesa} onChange={(e) => setNewTask((prev) => ({ ...prev, mesa: e.target.value }))} className="rounded-2xl border border-white/10 bg-zinc-900/80 px-3 py-3 text-sm outline-none">
                  {workspaces.map((mesa) => (
                    <SafeOption key={mesa}>{mesa}</SafeOption>
                  ))}
                </select>
                <select value={newTask.prioridad} onChange={(e) => setNewTask((prev) => ({ ...prev, prioridad: e.target.value }))} className="rounded-2xl border border-white/10 bg-zinc-900/80 px-3 py-3 text-sm outline-none">
                  <SafeOption>Alta</SafeOption>
                  <SafeOption>Media</SafeOption>
                  <SafeOption>Baja</SafeOption>
                </select>
                <div className="mt-2 flex flex-wrap gap-3 md:col-span-2">
                  <button type="button" onClick={closeTaskModal} className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-zinc-200">Cancelar</button>
                  <button type="submit" className="rounded-2xl bg-gradient-to-r from-fuchsia-400 to-violet-300 px-5 py-3 text-sm font-semibold text-zinc-950 shadow-[0_10px_30px_rgba(168,85,247,0.28)]">Guardar tarea</button>
                </div>
              </form>
            </div>
          </div>
        )}
      
    </div>
  );
}
