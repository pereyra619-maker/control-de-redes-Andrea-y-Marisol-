import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  LayoutDashboard,
  PanelsTopLeft,
  CalendarDays,
  KanbanSquare,
  Settings,
  Plus,
  Search,
  Sun,
  Moon,
  Bell,
  Copy,
  Cloud,
  RefreshCw,
  Download,
  Upload,
  Trash2,
} from "lucide-react";
import "./styles.css";

const STORAGE = {
  content: "cm_pwa_content_v1",
  tasks: "cm_pwa_tasks_v1",
  workspaces: "cm_pwa_workspaces_v1",
  settings: "cm_pwa_settings_v1",
  cloud: "cm_pwa_cloud_v1",
};

const CLOUD_TABLE = "cm_shared_boards";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "contenido", label: "Contenido", icon: PanelsTopLeft },
  { id: "calendario", label: "Calendario", icon: CalendarDays },
  { id: "equipo", label: "Equipo", icon: KanbanSquare },
  { id: "ajustes", label: "Ajustes", icon: Settings },
];

const demoContent = [
  {
    id: 1,
    mesa: "Master Class",
    nombre: "Reel lanzamiento",
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
    likes: 0,
    comentarios: 0,
    compartidos: 0,
    guardados: 0,
    respuestas: 0,
    clicks: 0,
  },
  {
    id: 2,
    mesa: "La Negrita",
    nombre: "Historia promo semanal",
    fecha: "2026-03-01",
    hora: "18:30",
    red: "Instagram",
    tipo: "Historia",
    objetivo: "Interacción",
    campana: "Promo",
    estado: "Publicado",
    link: "https://",
    alcance: 1820,
    impresiones: 2480,
    likes: 110,
    comentarios: 12,
    compartidos: 21,
    guardados: 18,
    respuestas: 14,
    clicks: 37,
  },
];

const demoTasks = [
  { id: 1, tarea: "Diseñar piezas de la semana", prioridad: "Alta", mesa: "Master Class", estado: "Pendiente" },
  { id: 2, tarea: "Cargar métricas", prioridad: "Media", mesa: "La Negrita", estado: "En curso" },
];

const demoWorkspaces = ["Master Class", "La Negrita"];

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function calcInteractions(item) {
  return item.likes + item.comentarios + item.compartidos + item.guardados + item.respuestas + item.clicks;
}

function calcER(item) {
  if (!item.alcance) return 0;
  return (calcInteractions(item) / item.alcance) * 100;
}

function metricBadge(item) {
  const er = calcER(item);
  if (!item.alcance) return { label: "Sin datos", tone: "muted" };
  if (er >= 8) return { label: "Buena", tone: "good" };
  if (er >= 4) return { label: "Regular", tone: "warn" };
  return { label: "Mala", tone: "bad" };
}

function buildDate(fecha, hora = "00:00") {
  if (!fecha) return null;
  return new Date(`${fecha}T${hora || "00:00"}:00`);
}

function shareCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function boardFromUrl() {
  const p = new URLSearchParams(window.location.search);
  return p.get("board") || "";
}

function App() {
  const [theme, setTheme] = useState(() => load(STORAGE.settings, { theme: "dark", activeTab: "dashboard", activeUser: "", sessionActive: false }).theme || "dark");
  const [activeTab, setActiveTab] = useState(() => load(STORAGE.settings, { activeTab: "dashboard" }).activeTab || "dashboard");
  const [activeUser, setActiveUser] = useState(() => load(STORAGE.settings, { activeUser: "" }).activeUser || "");
  const [sessionActive, setSessionActive] = useState(() => load(STORAGE.settings, { sessionActive: false }).sessionActive || false);

  const [content, setContent] = useState(() => load(STORAGE.content, demoContent));
  const [tasks, setTasks] = useState(() => load(STORAGE.tasks, demoTasks));
  const [workspaces, setWorkspaces] = useState(() => load(STORAGE.workspaces, demoWorkspaces));

  const cloudStored = load(STORAGE.cloud, {
    url: "",
    key: "",
    boardCode: boardFromUrl(),
    boardTitle: "Tablero CM compartido",
    autoSync: true,
  });

  const [workspaceFilter, setWorkspaceFilter] = useState("Todas");
  const [networkFilter, setNetworkFilter] = useState("Todas");
  const [search, setSearch] = useState("");
  const [showContentModal, setShowContentModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [notifiedIds, setNotifiedIds] = useState([]);
  const [dragTaskId, setDragTaskId] = useState(null);

  const [supabaseUrl, setSupabaseUrl] = useState(cloudStored.url);
  const [supabaseKey, setSupabaseKey] = useState(cloudStored.key);
  const [boardCode, setBoardCode] = useState(cloudStored.boardCode);
  const [boardTitle, setBoardTitle] = useState(cloudStored.boardTitle);
  const [autoSync, setAutoSync] = useState(cloudStored.autoSync);
  const [cloudClient, setCloudClient] = useState(null);
  const [cloudStatus, setCloudStatus] = useState("Local");
  const [cloudError, setCloudError] = useState("");
  const [lastSync, setLastSync] = useState("");

  const fileRef = useRef(null);

  const [newItem, setNewItem] = useState({
    mesa: demoWorkspaces[0],
    nombre: "",
    fecha: todayISO(),
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
    mesa: demoWorkspaces[0],
    estado: "Pendiente",
  });

  useEffect(() => {
    save(STORAGE.content, content);
  }, [content]);

  useEffect(() => {
    save(STORAGE.tasks, tasks);
  }, [tasks]);

  useEffect(() => {
    save(STORAGE.workspaces, workspaces);
  }, [workspaces]);

  useEffect(() => {
    save(STORAGE.settings, { theme, activeTab, activeUser, sessionActive });
    document.body.dataset.theme = theme;
  }, [theme, activeTab, activeUser, sessionActive]);

  useEffect(() => {
    save(STORAGE.cloud, { url: supabaseUrl, key: supabaseKey, boardCode, boardTitle, autoSync });
  }, [supabaseUrl, supabaseKey, boardCode, boardTitle, autoSync]);

  useEffect(() => {
    if ("Notification" in window) {
      setNotificationEnabled(Notification.permission === "granted");
    }
  }, []);

  const mesas = useMemo(() => ["Todas", ...workspaces], [workspaces]);
  const safeWorkspace = workspaces.includes(workspaceFilter) ? workspaceFilter : workspaceFilter === "Todas" ? "Todas" : "Todas";

  const filteredContent = useMemo(() => {
    const term = search.trim().toLowerCase();
    return content.filter((item) => {
      const workspaceOk = safeWorkspace === "Todas" || item.mesa === safeWorkspace;
      const networkOk = networkFilter === "Todas" || item.red === networkFilter;
      const searchOk =
        !term ||
        [item.nombre, item.mesa, item.campana, item.red, item.tipo, item.objetivo, item.estado]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(term));
      return workspaceOk && networkOk && searchOk;
    });
  }, [content, safeWorkspace, networkFilter, search]);

  const filteredTasks = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tasks.filter((task) => {
      const workspaceOk = safeWorkspace === "Todas" || task.mesa === safeWorkspace;
      const searchOk = !term || [task.tarea, task.mesa, task.prioridad, task.estado].some((v) => String(v).toLowerCase().includes(term));
      return workspaceOk && searchOk;
    });
  }, [tasks, safeWorkspace, search]);

  const totals = useMemo(() => {
    const piezas = filteredContent.length;
    const alcance = filteredContent.reduce((sum, item) => sum + item.alcance, 0);
    const interacciones = filteredContent.reduce((sum, item) => sum + calcInteractions(item), 0);
    const er = piezas ? filteredContent.reduce((sum, item) => sum + calcER(item), 0) / piezas : 0;
    return { piezas, alcance, interacciones, er };
  }, [filteredContent]);

  const operationalSummary = useMemo(() => ({
    publicado: filteredContent.filter((i) => i.estado === "Publicado").length,
    editado: filteredContent.filter((i) => i.estado === "Editado").length,
    editando: filteredContent.filter((i) => i.estado === "Editando").length,
    programado: filteredContent.filter((i) => i.estado === "Programado").length,
  }), [filteredContent]);

  const trend = useMemo(() => {
    const out = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(5, 10);
      const iso = d.toISOString().slice(0, 10);
      const dayItems = filteredContent.filter((item) => item.fecha === iso);
      out.push({
        label: key,
        reach: dayItems.reduce((sum, item) => sum + item.alcance, 0),
      });
    }
    const max = Math.max(...out.map((x) => x.reach), 1);
    return out.map((x) => ({ ...x, pct: Math.max(8, Math.round((x.reach / max) * 100)) }));
  }, [filteredContent]);

  const upcoming = useMemo(() => {
    const now = new Date();
    return filteredContent
      .filter((item) => item.estado === "Programado")
      .map((item) => {
        const dt = buildDate(item.fecha, item.hora);
        if (!dt) return null;
        const diff = Math.round((dt.getTime() - now.getTime()) / 60000);
        return { ...item, diff };
      })
      .filter(Boolean)
      .filter((item) => item.diff <= 60 && item.diff >= -120)
      .sort((a, b) => a.diff - b.diff);
  }, [filteredContent]);

  useEffect(() => {
    if (!("Notification" in window)) return;
    const timer = setInterval(() => {
      const now = new Date();
      content.forEach((item) => {
        if (item.estado !== "Programado") return;
        const dt = buildDate(item.fecha, item.hora);
        if (!dt) return;
        const diff = Math.round((dt.getTime() - now.getTime()) / 60000);
        if (diff <= 15 && diff >= -5 && !notifiedIds.includes(item.id)) {
          if (Notification.permission === "granted") {
            new Notification("Recordatorio de publicación", {
              body: `${item.nombre} • ${item.mesa} • ${item.red} a las ${item.hora}`,
            });
          }
          setNotifiedIds((prev) => [...prev, item.id]);
        }
      });
    }, 30000);
    return () => clearInterval(timer);
  }, [content, notifiedIds]);

  useEffect(() => {
    if (!autoSync || !cloudClient || !sessionActive || !boardCode) return;
    const t = setTimeout(() => {
      pushToCloud();
    }, 900);
    return () => clearTimeout(t);
  }, [content, tasks, workspaces, autoSync, cloudClient, sessionActive, boardCode]);

  function exportBackup() {
    const payload = {
      content,
      tasks,
      workspaces,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cm-control-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importBackup(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || "{}"));
        if (Array.isArray(data.content)) setContent(data.content);
        if (Array.isArray(data.tasks)) setTasks(data.tasks);
        if (Array.isArray(data.workspaces)) setWorkspaces(data.workspaces);
      } catch {
        alert("El archivo no es válido.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function toggleTheme() {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }

  async function enableNotifications() {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationEnabled(permission === "granted");
  }

  function startSession() {
    if (!activeUser.trim()) {
      setCloudError("Poné tu nombre para entrar.");
      return;
    }
    setSessionActive(true);
    setCloudError("");
  }

  function endSession() {
    setSessionActive(false);
  }

  async function connectSupabase() {
    setCloudError("");
    if (!supabaseUrl.trim() || !supabaseKey.trim()) {
      setCloudError("Pegá la URL y la key pública.");
      return;
    }
    try {
      const client = createClient(supabaseUrl.trim(), supabaseKey.trim());
      setCloudClient(client);
      setCloudStatus("Conectado");
    } catch (e) {
      setCloudStatus("Error");
      setCloudClient(null);
      setCloudError(e?.message || "No se pudo conectar.");
    }
  }

  function snapshot() {
    return { content, tasks, workspaces };
  }

  function applySnapshot(data) {
    if (!data) return;
    if (Array.isArray(data.content)) setContent(data.content);
    if (Array.isArray(data.tasks)) setTasks(data.tasks);
    if (Array.isArray(data.workspaces)) setWorkspaces(data.workspaces);
  }

  async function createBoard() {
    if (!cloudClient || !sessionActive) {
      setCloudError("Primero conectá y entrá.");
      return;
    }
    const code = boardCode.trim() || shareCode();
    setBoardCode(code);
    const { error } = await cloudClient.from(CLOUD_TABLE).upsert(
      {
        share_code: code,
        title: boardTitle.trim() || "Tablero CM compartido",
        payload: snapshot(),
        updated_by_name: activeUser || "Invitada",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "share_code" }
    );
    if (error) {
      setCloudError(error.message);
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("board", code);
    window.history.replaceState({}, "", url.toString());
    setCloudStatus("Tablero listo");
    setLastSync(new Date().toLocaleString("es-AR"));
  }

  async function openBoard() {
    if (!cloudClient || !sessionActive || !boardCode.trim()) {
      setCloudError("Conectá, entrá y poné el código.");
      return;
    }
    const { data, error } = await cloudClient
      .from(CLOUD_TABLE)
      .select("payload, title, updated_at")
      .eq("share_code", boardCode.trim())
      .single();

    if (error) {
      setCloudError(error.message);
      return;
    }

    if (data?.title) setBoardTitle(data.title);
    applySnapshot(data?.payload);
    setLastSync(new Date(data?.updated_at || new Date()).toLocaleString("es-AR"));
    setCloudStatus("Sincronizado");
  }

  async function pushToCloud() {
    if (!cloudClient || !sessionActive || !boardCode.trim()) return;
    const { error } = await cloudClient.from(CLOUD_TABLE).upsert(
      {
        share_code: boardCode.trim(),
        title: boardTitle.trim() || "Tablero CM compartido",
        payload: snapshot(),
        updated_by_name: activeUser || "Invitada",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "share_code" }
    );
    if (!error) {
      setLastSync(new Date().toLocaleString("es-AR"));
      setCloudStatus("Sincronizado");
    }
  }

  async function copyLink() {
    if (!boardCode.trim()) return;
    const url = new URL(window.location.href);
    url.searchParams.set("board", boardCode.trim());
    await navigator.clipboard.writeText(url.toString());
  }

  function addWorkspace() {
    const name = prompt("Nombre de la mesa / cliente:");
    if (!name || !name.trim()) return;
    const clean = name.trim();
    if (workspaces.includes(clean)) return;
    setWorkspaces((prev) => [...prev, clean]);
    setNewItem((prev) => ({ ...prev, mesa: clean }));
    setNewTask((prev) => ({ ...prev, mesa: clean }));
  }

  function addContent(e) {
    e.preventDefault();
    if (!newItem.nombre.trim()) return;
    const item = {
      id: Date.now(),
      ...newItem,
      alcance: 0,
      impresiones: 0,
      likes: 0,
      comentarios: 0,
      compartidos: 0,
      guardados: 0,
      respuestas: 0,
      clicks: 0,
    };
    setContent((prev) => [item, ...prev]);
    setNewItem((prev) => ({ ...prev, nombre: "", campana: "", link: "https://", fecha: todayISO(), hora: "10:00" }));
    setShowContentModal(false);
    setActiveTab("contenido");
  }

  function addTask(e) {
    e.preventDefault();
    if (!newTask.tarea.trim()) return;
    setTasks((prev) => [{ id: Date.now(), ...newTask }, ...prev]);
    setNewTask((prev) => ({ ...prev, tarea: "", prioridad: "Media", estado: "Pendiente" }));
    setShowTaskModal(false);
    setActiveTab("equipo");
  }

  function updateField(id, field, value) {
    setContent((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }

  function updateMetric(id, field, value) {
    setContent((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: Number(value) || 0 } : item)));
  }

  function removeContent(id) {
    setContent((prev) => prev.filter((item) => item.id !== id));
  }

  function removeTask(id) {
    setTasks((prev) => prev.filter((task) => task.id !== id));
  }

  function moveTask(id, status) {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, estado: status } : task)));
  }

  function renderDashboard() {
    return (
      <div className="stack">
        <div className="stats-grid">
          <button className="stat-card" onClick={() => setActiveTab("ajustes")}>
            <div className="stat-top"><span>Usuario activo</span><Cloud size={16} /></div>
            <strong>{activeUser || "Sin nombre"}</strong>
            <small>Ir a ajustes</small>
          </button>
          <button className="stat-card" onClick={() => setActiveTab("contenido")}>
            <div className="stat-top"><span>Piezas</span><PanelsTopLeft size={16} /></div>
            <strong>{totals.piezas}</strong>
            <small>Abrir contenido</small>
          </button>
          <button className="stat-card" onClick={() => setActiveTab("calendario")}>
            <div className="stat-top"><span>Alcance</span><CalendarDays size={16} /></div>
            <strong>{totals.alcance.toLocaleString("es-AR")}</strong>
            <small>Ver calendario</small>
          </button>
          <button className="stat-card" onClick={() => setActiveTab("equipo")}>
            <div className="stat-top"><span>ER promedio</span><KanbanSquare size={16} /></div>
            <strong>{totals.er.toFixed(2)}%</strong>
            <small>Ver equipo</small>
          </button>
        </div>

        <div className="two-col">
          <section className="panel">
            <div className="panel-head">
              <div>
                <h3>Tendencia 7 días</h3>
                <p>Alcance acumulado por día</p>
              </div>
            </div>
            <div className="chart-bars">
              {trend.map((day) => (
                <div key={day.label} className="chart-col">
                  <div className="bar-shell">
                    <div className="bar-fill" style={{ height: `${day.pct}%` }} />
                  </div>
                  <span>{day.label}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <h3>Estado operativo</h3>
                <p>Cómo está tu trabajo hoy</p>
              </div>
            </div>
            <div className="status-list">
              <div className="status-row"><span>Publicado</span><b>{operationalSummary.publicado}</b></div>
              <div className="status-row"><span>Editado</span><b>{operationalSummary.editado}</b></div>
              <div className="status-row"><span>Editando</span><b>{operationalSummary.editando}</b></div>
              <div className="status-row"><span>Programado</span><b>{operationalSummary.programado}</b></div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  function renderContenido() {
    return (
      <div className="stack">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h3>Control de contenido</h3>
              <p>Planificación, métricas y estado</p>
            </div>
            <div className="row gap">
              <span className="pill">{cloudClient && sessionActive && boardCode ? "Compartido" : "Local"}</span>
              <span className="pill soft">{activeUser || "Sin nombre"}</span>
            </div>
          </div>

          <div className="stack">
            {filteredContent.map((item) => {
              const badge = metricBadge(item);
              return (
                <article key={item.id} className="content-card">
                  <div className="content-top">
                    <div className="stack sm">
                      <input className="title-input" value={item.nombre} onChange={(e) => updateField(item.id, "nombre", e.target.value)} />
                      <div className="row gap wrap">
                        <span className="pill accent">{item.mesa}</span>
                        <span className="pill soft">{item.red}</span>
                        <span className="pill soft">{item.tipo}</span>
                        <span className={`pill ${badge.tone}`}>{badge.label}</span>
                      </div>
                    </div>
                    <button className="icon-btn" onClick={() => removeContent(item.id)} title="Eliminar">
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="metric-grid">
                    <div className="mini-stat"><span>Interacciones</span><b>{calcInteractions(item)}</b></div>
                    <div className="mini-stat"><span>ER</span><b>{calcER(item).toFixed(2)}%</b></div>
                    <div className="mini-stat"><span>Objetivo</span><b>{item.objetivo}</b></div>
                    <div className="mini-stat"><span>Estado</span><b>{item.estado}</b></div>
                  </div>

                  <div className="editor-grid">
                    <select value={item.mesa} onChange={(e) => updateField(item.id, "mesa", e.target.value)}>{workspaces.map((w) => <option key={w}>{w}</option>)}</select>
                    <select value={item.estado} onChange={(e) => updateField(item.id, "estado", e.target.value)}>
                      <option>Programado</option>
                      <option>Editando</option>
                      <option>Editado</option>
                      <option>Publicado</option>
                    </select>
                    <select value={item.red} onChange={(e) => updateField(item.id, "red", e.target.value)}>
                      <option>Instagram</option>
                      <option>Facebook</option>
                      <option>TikTok</option>
                      <option>LinkedIn</option>
                    </select>
                    <select value={item.tipo} onChange={(e) => updateField(item.id, "tipo", e.target.value)}>
                      <option>Post</option>
                      <option>Reel</option>
                      <option>Historia</option>
                      <option>Carrusel</option>
                      <option>Anuncio</option>
                    </select>
                    <input type="date" value={item.fecha} onChange={(e) => updateField(item.id, "fecha", e.target.value)} />
                    <input type="time" value={item.hora} onChange={(e) => updateField(item.id, "hora", e.target.value)} />
                    <select value={item.objetivo} onChange={(e) => updateField(item.id, "objetivo", e.target.value)}>
                      <option>Alcance</option>
                      <option>Interacción</option>
                      <option>Comunidad</option>
                      <option>Leads</option>
                      <option>Ventas</option>
                    </select>
                    <input value={item.campana} onChange={(e) => updateField(item.id, "campana", e.target.value)} placeholder="Campaña" />
                    <input className="wide" value={item.link} onChange={(e) => updateField(item.id, "link", e.target.value)} placeholder="Link" />
                  </div>

                  <div className="editor-grid metrics">
                    <label><span>Alcance</span><input type="number" value={item.alcance} onChange={(e) => updateMetric(item.id, "alcance", e.target.value)} /></label>
                    <label><span>Impresiones</span><input type="number" value={item.impresiones} onChange={(e) => updateMetric(item.id, "impresiones", e.target.value)} /></label>
                    <label><span>Likes</span><input type="number" value={item.likes} onChange={(e) => updateMetric(item.id, "likes", e.target.value)} /></label>
                    <label><span>Comentarios</span><input type="number" value={item.comentarios} onChange={(e) => updateMetric(item.id, "comentarios", e.target.value)} /></label>
                    <label><span>Compartidos</span><input type="number" value={item.compartidos} onChange={(e) => updateMetric(item.id, "compartidos", e.target.value)} /></label>
                    <label><span>Guardados</span><input type="number" value={item.guardados} onChange={(e) => updateMetric(item.id, "guardados", e.target.value)} /></label>
                    <label><span>Respuestas</span><input type="number" value={item.respuestas} onChange={(e) => updateMetric(item.id, "respuestas", e.target.value)} /></label>
                    <label><span>Clicks</span><input type="number" value={item.clicks} onChange={(e) => updateMetric(item.id, "clicks", e.target.value)} /></label>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  function renderCalendario() {
    const base = new Date();
    const year = base.getFullYear();
    const month = base.getMonth();
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(year, month, 1 - offset);
    const days = Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });

    const map = {};
    filteredContent.forEach((item) => {
      if (!item.fecha) return;
      if (!map[item.fecha]) map[item.fecha] = [];
      map[item.fecha].push(item);
    });

    return (
      <div className="two-col">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h3>Calendario</h3>
              <p>Mes actual</p>
            </div>
          </div>
          <div className="calendar-head">
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => <span key={d}>{d}</span>)}
          </div>
          <div className="calendar-grid">
            {days.map((day) => {
              const iso = day.toISOString().slice(0, 10);
              const items = map[iso] || [];
              const same = day.getMonth() === month;
              return (
                <div key={iso} className={`day-card ${same ? "" : "faded"}`}>
                  <strong>{day.getDate()}</strong>
                  {items.slice(0, 2).map((item) => <div key={item.id} className="mini-chip">{item.hora} • {item.red}</div>)}
                  {items.length > 2 ? <small>+{items.length - 2} más</small> : null}
                </div>
              );
            })}
          </div>
        </section>

        <div className="stack">
          <section className="panel">
            <div className="panel-head">
              <div>
                <h3>Recordatorios</h3>
                <p>Publicaciones próximas</p>
              </div>
              <button className="ghost-btn" onClick={enableNotifications}>
                <Bell size={16} />
                {notificationEnabled ? "Avisos activos" : "Activar avisos"}
              </button>
            </div>
            <div className="stack">
              {upcoming.length === 0 ? <div className="empty-box">No hay publicaciones próximas en la próxima hora.</div> : upcoming.map((item) => (
                <div key={item.id} className="alert-card">
                  <div>
                    <b>{item.nombre}</b>
                    <small>{item.mesa} • {item.red}</small>
                  </div>
                  <span className={`pill ${item.diff < 0 ? "bad" : "warn"}`}>{item.diff < 0 ? `Atrasado ${Math.abs(item.diff)} min` : `En ${item.diff} min`}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  }

  function renderEquipo() {
    const columns = ["Pendiente", "En curso", "Hecha"];
    return (
      <div className="stack">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h3>Kanban del equipo</h3>
              <p>Arrastrá tareas entre columnas</p>
            </div>
          </div>
          <div className="kanban-grid">
            {columns.map((status) => (
              <div
                key={status}
                className="kanban-col"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragTaskId) moveTask(dragTaskId, status);
                  setDragTaskId(null);
                }}
              >
                <div className="kanban-head">
                  <strong>{status}</strong>
                  <span>{filteredTasks.filter((t) => t.estado === status).length}</span>
                </div>
                <div className="stack sm">
                  {filteredTasks.filter((t) => t.estado === status).map((task) => (
                    <div
                      key={task.id}
                      className="task-card"
                      draggable
                      onDragStart={() => setDragTaskId(task.id)}
                      onDragEnd={() => setDragTaskId(null)}
                    >
                      <div className="row between">
                        <b>{task.tarea}</b>
                        <button className="icon-btn" onClick={() => removeTask(task.id)} title="Eliminar">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="row gap wrap">
                        <span className="pill accent">{task.mesa}</span>
                        <span className={`pill ${task.prioridad === "Alta" ? "bad" : task.prioridad === "Media" ? "warn" : "soft"}`}>{task.prioridad}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  function renderAjustes() {
    return (
      <div className="two-col">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h3>Apariencia y respaldo</h3>
              <p>Modo visual y backups rápidos</p>
            </div>
          </div>

          <div className="stack">
            <div className="setting-row">
              <div>
                <b>Tema</b>
                <small>Claro u oscuro</small>
              </div>
              <button className="ghost-btn" onClick={toggleTheme}>
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                {theme === "dark" ? "Modo claro" : "Modo oscuro"}
              </button>
            </div>

            <div className="setting-row">
              <div>
                <b>Backup local</b>
                <small>Exportar o importar JSON</small>
              </div>
              <div className="row gap">
                <button className="ghost-btn" onClick={exportBackup}><Download size={16} />Exportar</button>
                <button className="ghost-btn" onClick={() => fileRef.current?.click()}><Upload size={16} />Importar</button>
                <input ref={fileRef} type="file" accept="application/json" hidden onChange={importBackup} />
              </div>
            </div>

            <div className="setting-row">
              <div>
                <b>Restablecer demo</b>
                <small>Vuelve a los datos de ejemplo</small>
              </div>
              <button className="ghost-btn" onClick={() => {
                setContent(demoContent);
                setTasks(demoTasks);
                setWorkspaces(demoWorkspaces);
                setSearch("");
                setWorkspaceFilter("Todas");
                setNetworkFilter("Todas");
              }}>
                <RefreshCw size={16} />Restablecer
              </button>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h3>Trabajo compartido (Supabase)</h3>
              <p>Dos PCs / dos personas / mismo tablero</p>
            </div>
          </div>

          <div className="stack">
            <input value={supabaseUrl} onChange={(e) => setSupabaseUrl(e.target.value)} placeholder="https://tu-proyecto.supabase.co" />
            <input value={supabaseKey} onChange={(e) => setSupabaseKey(e.target.value)} placeholder="Tu key pública" />
            <div className="grid-2">
              {!cloudClient ? (
                <button className="ghost-btn" onClick={connectSupabase}><Cloud size={16} />Conectar</button>
              ) : (
                <button className="ghost-btn" onClick={() => { setCloudClient(null); setCloudStatus("Local"); }}><Cloud size={16} />Desconectar</button>
              )}
              {!sessionActive ? (
                <button className="ghost-btn" onClick={startSession}>Entrar</button>
              ) : (
                <button className="ghost-btn" onClick={endSession}>Salir</button>
              )}
            </div>

            <input value={activeUser} onChange={(e) => setActiveUser(e.target.value)} placeholder="Tu nombre" />
            <input value={boardTitle} onChange={(e) => setBoardTitle(e.target.value)} placeholder="Nombre del tablero" />
            <input value={boardCode} onChange={(e) => setBoardCode(e.target.value.toUpperCase())} placeholder="Código del tablero" />

            <div className="grid-2">
              <button className="ghost-btn" onClick={createBoard}>Crear tablero</button>
              <button className="ghost-btn" onClick={openBoard}>Abrir tablero</button>
              <button className="ghost-btn" onClick={pushToCloud}>Guardar nube</button>
              <button className="ghost-btn" onClick={copyLink}><Copy size={16} />Copiar link</button>
            </div>

            <label className="check-line">
              <input type="checkbox" checked={autoSync} onChange={(e) => setAutoSync(e.target.checked)} />
              Auto-sync
            </label>

            <div className="stack sm">
              <span className="pill">{cloudStatus}</span>
              {lastSync ? <small>Última sync: {lastSync}</small> : null}
              {cloudError ? <div className="error-box">{cloudError}</div> : null}
            </div>

            <div className="sql-box">
              <b>SQL para Supabase</b>
              <pre>{`create extension if not exists pgcrypto;

create table if not exists public.cm_shared_boards (
  id uuid primary key default gen_random_uuid(),
  share_code text unique not null,
  title text not null,
  payload jsonb not null,
  updated_by_name text,
  updated_at timestamptz default now()
);

alter table public.cm_shared_boards enable row level security;

create policy "shared boards select public" on public.cm_shared_boards for select using (true);
create policy "shared boards insert public" on public.cm_shared_boards for insert with check (true);
create policy "shared boards update public" on public.cm_shared_boards for update using (true) with check (true);`}</pre>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const tabContent = {
    dashboard: renderDashboard(),
    contenido: renderContenido(),
    calendario: renderCalendario(),
    equipo: renderEquipo(),
    ajustes: renderAjustes(),
  };

  const isDark = theme === "dark";

  return (
    <div className={`app ${isDark ? "theme-dark" : "theme-light"}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-badge">Panel CM premium</div>
          <h1>Control de redes</h1>
          <p>Instalable en PC y celular como PWA.</p>
        </div>

        <nav className="nav">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} className={`nav-btn ${activeTab === tab.id ? "active" : ""}`} onClick={() => setActiveTab(tab.id)}>
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="side-card">
          <small>Sesión</small>
          <strong>{activeUser || "Sin nombre"}</strong>
          <div className="row gap wrap">
            <span className="pill soft">{sessionActive ? "Activa" : "Pendiente"}</span>
            <span className="pill">{cloudClient ? cloudStatus : "Local"}</span>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="hero">
          <div>
            <div className="brand-badge mobile-only">Panel CM premium</div>
            <h2>{TABS.find((t) => t.id === activeTab)?.label}</h2>
            <p>Calendario, métricas, Kanban, backup y trabajo compartido en una sola app.</p>
          </div>

          <div className="row gap wrap">
            <button className="primary-btn" onClick={() => setShowContentModal(true)}>
              <Plus size={16} /> Nuevo contenido
            </button>
            <button className="ghost-btn" onClick={() => setShowTaskModal(true)}>
              <Plus size={16} /> Nueva tarea
            </button>
            <button className="ghost-btn" onClick={addWorkspace}>
              <Plus size={16} /> Nueva mesa
            </button>
            <button className="ghost-btn" onClick={toggleTheme}>
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>

          <div className="hero-tools">
            <div className="workspace-switch">
              {mesas.map((mesa) => (
                <button key={mesa} className={safeWorkspace === mesa ? "active" : ""} onClick={() => setWorkspaceFilter(mesa)}>
                  {mesa}
                </button>
              ))}
            </div>

            <div className="search-box">
              <Search size={16} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar contenido, campaña, cliente o tarea" />
            </div>
          </div>
        </header>

        <div className="mobile-tabs">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} className={`nav-btn ${activeTab === tab.id ? "active" : ""}`} onClick={() => setActiveTab(tab.id)}>
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {tabContent[activeTab]}
      </main>

      {showContentModal && (
        <div className="modal-backdrop" onClick={() => setShowContentModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="brand-badge">Modal premium</div>
                <h3>Crear contenido</h3>
                <p>Carga rápida y limpia.</p>
              </div>
              <button className="icon-btn" onClick={() => setShowContentModal(false)}>✕</button>
            </div>

            <form onSubmit={addContent} className="form-grid">
              <select value={newItem.mesa} onChange={(e) => setNewItem((prev) => ({ ...prev, mesa: e.target.value }))}>{workspaces.map((w) => <option key={w}>{w}</option>)}</select>
              <input value={newItem.nombre} onChange={(e) => setNewItem((prev) => ({ ...prev, nombre: e.target.value }))} placeholder="Nombre del contenido" className="span-2" />
              <input type="date" value={newItem.fecha} onChange={(e) => setNewItem((prev) => ({ ...prev, fecha: e.target.value }))} />
              <input type="time" value={newItem.hora} onChange={(e) => setNewItem((prev) => ({ ...prev, hora: e.target.value }))} />
              <select value={newItem.red} onChange={(e) => setNewItem((prev) => ({ ...prev, red: e.target.value }))}>
                <option>Instagram</option>
                <option>Facebook</option>
                <option>TikTok</option>
                <option>LinkedIn</option>
              </select>
              <select value={newItem.tipo} onChange={(e) => setNewItem((prev) => ({ ...prev, tipo: e.target.value }))}>
                <option>Post</option>
                <option>Reel</option>
                <option>Historia</option>
                <option>Carrusel</option>
                <option>Anuncio</option>
              </select>
              <select value={newItem.objetivo} onChange={(e) => setNewItem((prev) => ({ ...prev, objetivo: e.target.value }))}>
                <option>Alcance</option>
                <option>Interacción</option>
                <option>Comunidad</option>
                <option>Leads</option>
                <option>Ventas</option>
              </select>
              <select value={newItem.estado} onChange={(e) => setNewItem((prev) => ({ ...prev, estado: e.target.value }))}>
                <option>Programado</option>
                <option>Editando</option>
                <option>Editado</option>
                <option>Publicado</option>
              </select>
              <input value={newItem.campana} onChange={(e) => setNewItem((prev) => ({ ...prev, campana: e.target.value }))} placeholder="Campaña" className="span-2" />
              <input value={newItem.link} onChange={(e) => setNewItem((prev) => ({ ...prev, link: e.target.value }))} placeholder="Link" className="span-2" />

              <div className="row gap span-2">
                <button type="button" className="ghost-btn" onClick={() => setShowContentModal(false)}>Cancelar</button>
                <button type="submit" className="primary-btn">Guardar contenido</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTaskModal && (
        <div className="modal-backdrop" onClick={() => setShowTaskModal(false)}>
          <div className="modal small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="brand-badge">Modal premium</div>
                <h3>Crear tarea</h3>
                <p>Rápida y limpia.</p>
              </div>
              <button className="icon-btn" onClick={() => setShowTaskModal(false)}>✕</button>
            </div>

            <form onSubmit={addTask} className="form-grid">
              <input value={newTask.tarea} onChange={(e) => setNewTask((prev) => ({ ...prev, tarea: e.target.value }))} placeholder="Nueva tarea" className="span-2" />
              <select value={newTask.mesa} onChange={(e) => setNewTask((prev) => ({ ...prev, mesa: e.target.value }))}>{workspaces.map((w) => <option key={w}>{w}</option>)}</select>
              <select value={newTask.prioridad} onChange={(e) => setNewTask((prev) => ({ ...prev, prioridad: e.target.value }))}>
                <option>Alta</option>
                <option>Media</option>
                <option>Baja</option>
              </select>

              <div className="row gap span-2">
                <button type="button" className="ghost-btn" onClick={() => setShowTaskModal(false)}>Cancelar</button>
                <button type="submit" className="primary-btn">Guardar tarea</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
