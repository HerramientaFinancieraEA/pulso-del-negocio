// app.js — interfaz: pestañas, formularios y renderizado.
// La lógica financiera vive en calc.js; todo lo de Firebase vive en db.js.

// calc.js y firebase-config.js son archivos locales puros (sin red), así que
// se importan de forma normal. db.js, en cambio, depende de que el navegador
// pueda descargar el SDK de Firebase desde su CDN — en una conexión lenta o
// bloqueada esa descarga puede fallar. Por eso db.js se carga de forma
// DINÁMICA (import() dentro de un try/catch): si falla, el resto de la
// aplicación (pestañas, formularios, cálculos) sigue funcionando con
// normalidad; solo se pierde la posibilidad de guardar en la nube.
import {
  computeSeries,
  semaforoDe,
  capacidadCredito,
  simularCredito,
  esViable,
} from "./calc.js";
import { ADMIN_CODE } from "./firebase-config.js";

const q = (id) => document.getElementById(id);
const fmt = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-CO");
const todayISO = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 10);

let session = null; // { id, nombre, config, entries }
let isNewBusiness = false;
let dbApi = null; // se llena si db.js carga correctamente

const THEME_KEY = "pulso_theme";
const LAST_LOGIN_KEY = "pulso_last_login";

const SIN_CONEXION_MSG =
  "No se pudo conectar con el almacenamiento en la nube (revisa tu conexión a internet o intenta de nuevo en un momento). Puedes seguir explorando la herramienta mientras tanto.";

async function loadDbModule() {
  try {
    const mod = await import("./db.js");
    dbApi = mod;
    return true;
  } catch (e) {
    console.error("No se pudo cargar js/db.js:", e);
    dbApi = null;
    return false;
  }
}

// ---------- init ----------
async function init() {
  initTheme();

  // La interfaz se conecta primero — funciona aunque Firebase no cargue.
  wireTabButtons();
  wireInicio();
  wireLogin();
  wireConfigForm();
  wireEntryForm();
  wireSimForm();
  wireAdmin();
  wireTheme();
  showTab("inicio");

  const loaded = await loadDbModule();
  if (!loaded) {
    showLoginMsg(SIN_CONEXION_MSG, "err");
    return;
  }
  const fb = dbApi.initFirebase();
  if (!fb.ok) {
    showLoginMsg(
      "No se pudo inicializar el almacenamiento (revisa js/firebase-config.js).",
      "err"
    );
    return;
  }
  tryAutoLogin();
}

function wireTabButtons() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      if (btn.disabled) return;
      showTab(tab);
    });
  });
}

function showTab(tab) {
  document.querySelectorAll(".panel").forEach((p) => {
    p.hidden = p.dataset.panel !== tab;
  });
  document.querySelectorAll(".tab-btn").forEach((b) => {
    if (b.dataset.tab === tab) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  if (tab === "registro-diario") renderRecent();
  if (tab === "resultados") renderResultados();
  if (tab === "asesor") renderAsesor();
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}

function setSessionActive(active) {
  ["registro-diario", "resultados", "asesor"].forEach((tab) => {
    const btn = document.querySelector('.tab-btn[data-tab="' + tab + '"]');
    if (btn) btn.disabled = !active;
  });
  const label = q("session-label");
  if (active && session) {
    label.hidden = false;
    label.textContent = session.nombre;
  } else {
    label.hidden = true;
  }
}

// ---------- Inicio ----------
function wireInicio() {
  q("btn-empezar").addEventListener("click", () => showTab("registro-inicial"));
}

// ---------- Registro inicial: login ----------
function wireLogin() {
  q("form-login").addEventListener("submit", async (evt) => {
    evt.preventDefault();
    const nombre = q("login-nombre").value.trim();
    const pin = q("login-pin").value.trim();
    if (!/^\d{4}$/.test(pin)) {
      showLoginMsg("El código debe tener exactamente 4 dígitos.", "err");
      return;
    }
    if (!nombre) {
      showLoginMsg("Escribe el nombre de tu negocio.", "err");
      return;
    }
    if (!dbApi) {
      showLoginMsg(SIN_CONEXION_MSG, "err");
      return;
    }
    showLoginMsg("Buscando tu registro…", "ok");
    try {
      const result = await dbApi.loadNegocio(nombre, pin);
      if (result.exists) {
        session = {
          id: result.id,
          nombre: result.data.nombre || nombre,
          config: normalizeConfig(result.data.config),
          entries: result.data.entries || [],
        };
        isNewBusiness = false;
        localStorage.setItem(LAST_LOGIN_KEY, JSON.stringify({ nombre, pin }));
        showLoginMsg("¡Bienvenida/o de nuevo, " + session.nombre + "!", "ok");
        fillConfigForm(session.config, session.nombre);
        q("form-config").hidden = false;
        setSessionActive(true);
        showTab("registro-diario");
      } else {
        session = {
          id: result.id,
          nombre,
          config: blankConfig(),
          entries: [],
        };
        isNewBusiness = true;
        showLoginMsg(
          "Negocio nuevo — completa tus datos iniciales abajo para crear tu registro.",
          "ok"
        );
        fillConfigForm(session.config, session.nombre);
        q("form-config").hidden = false;
        q("form-config").scrollIntoView({ behavior: "smooth" });
      }
    } catch (e) {
      showLoginMsg("No se pudo conectar con el almacenamiento: " + e.message, "err");
    }
  });
}

function showLoginMsg(text, kind) {
  const el = q("login-msg");
  el.hidden = false;
  el.textContent = text;
  el.className = "form-msg " + (kind || "");
}

async function tryAutoLogin() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(LAST_LOGIN_KEY) || "null");
  } catch (e) {
    saved = null;
  }
  if (!saved || !saved.nombre || !saved.pin) return;
  q("login-nombre").value = saved.nombre;
  q("login-pin").value = saved.pin;
}

// ---------- Registro inicial: configuración ----------
function blankConfig() {
  return { cash: 0, inventory: 0, assets: [], debts: [], capital: 0 };
}

function normalizeConfig(cfg) {
  cfg = cfg || {};
  return {
    cash: Number(cfg.cash) || 0,
    inventory: Number(cfg.inventory) || 0,
    assets: Array.isArray(cfg.assets) ? cfg.assets.map((a) => ({ id: a.id || uid(), name: a.name || "", value: Number(a.value) || 0 })) : [],
    debts: Array.isArray(cfg.debts) ? cfg.debts.map((d) => ({ id: d.id || uid(), name: d.name || "", value: Number(d.value) || 0 })) : [],
    capital: Number(cfg.capital) || 0,
  };
}

function fillConfigForm(cfg, nombre) {
  q("config-title").textContent = "Datos iniciales de " + (nombre || "tu negocio");
  q("cfg-cash").value = cfg.cash || "";
  q("cfg-inventory").value = cfg.inventory || "";
  q("cfg-capital").value = cfg.capital || "";
  renderRowsList("rows-assets", cfg.assets, "Ej: Carrito de venta", "Valor $");
  renderRowsList("rows-debts", cfg.debts, "Ej: Proveedor de harina", "Valor $");
}

function renderRowsList(containerId, list, placeholderName, placeholderVal) {
  const el = q(containerId);
  el.innerHTML = "";
  list.forEach((item) => {
    const row = document.createElement("div");
    row.className = "list-row";
    row.innerHTML =
      '<input type="text" data-id="' + item.id + '" data-field="name" placeholder="' + placeholderName + '" value="' + escapeAttr(item.name) + '">' +
      '<input type="number" min="0" step="1000" data-id="' + item.id + '" data-field="value" placeholder="' + placeholderVal + '" value="' + (item.value || "") + '">' +
      '<button type="button" data-remove="' + item.id + '" title="Quitar">✕</button>';
    el.appendChild(row);
  });
}

function escapeAttr(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

const listGetters = {
  "rows-assets": () => (session ? session.config.assets : []),
  "rows-debts": () => (session ? session.config.debts : []),
};

function wireListEvents(containerId) {
  const getList = listGetters[containerId];
  q(containerId).addEventListener("input", (evt) => {
    const t = evt.target;
    const id = t.getAttribute("data-id"),
      field = t.getAttribute("data-field");
    if (!id) return;
    const item = getList().find((i) => i.id === id);
    if (!item) return;
    item[field] = field === "value" ? Number(t.value) || 0 : t.value;
  });
  q(containerId).addEventListener("click", (evt) => {
    const id = evt.target.getAttribute("data-remove");
    if (!id) return;
    const list = getList();
    const idx = list.findIndex((i) => i.id === id);
    if (idx > -1) list.splice(idx, 1);
    renderRowsList(
      containerId,
      list,
      containerId === "rows-assets" ? "Ej: Carrito de venta" : "Ej: Proveedor de harina",
      "Valor $"
    );
  });
}

function wireConfigForm() {
  q("add-asset").addEventListener("click", () => {
    if (!session) return;
    session.config.assets.push({ id: uid(), name: "", value: 0 });
    renderRowsList("rows-assets", session.config.assets, "Ej: Carrito de venta", "Valor $");
  });
  q("add-debt").addEventListener("click", () => {
    if (!session) return;
    session.config.debts.push({ id: uid(), name: "", value: 0 });
    renderRowsList("rows-debts", session.config.debts, "Ej: Proveedor de harina", "Valor $");
  });
  wireListEvents("rows-assets");
  wireListEvents("rows-debts");

  q("form-config").addEventListener("submit", async (evt) => {
    evt.preventDefault();
    if (!session) return;
    session.config.cash = Number(q("cfg-cash").value) || 0;
    session.config.inventory = Number(q("cfg-inventory").value) || 0;
    session.config.capital = Number(q("cfg-capital").value) || 0;

    const msg = q("config-msg");
    msg.hidden = false;
    if (!dbApi) {
      msg.className = "form-msg err";
      msg.textContent = SIN_CONEXION_MSG;
      return;
    }
    msg.className = "form-msg";
    msg.textContent = "Guardando…";
    try {
      await dbApi.saveNegocio(session.id, {
        nombre: session.nombre,
        config: session.config,
        entries: session.entries,
      });
      msg.className = "form-msg ok";
      msg.textContent = "Guardado.";
      setSessionActive(true);
      if (isNewBusiness) {
        const pin = q("login-pin").value.trim();
        if (pin) localStorage.setItem(LAST_LOGIN_KEY, JSON.stringify({ nombre: session.nombre, pin }));
        isNewBusiness = false;
        showTab("registro-diario");
      }
    } catch (e) {
      msg.className = "form-msg err";
      msg.textContent = "No se pudo guardar: " + e.message;
    }
  });
}

// ---------- Registro diario ----------
function wireEntryForm() {
  q("e-date").value = todayISO();
  q("form-entry").addEventListener("submit", async (evt) => {
    evt.preventDefault();
    if (!session) return;
    const date = q("e-date").value || todayISO();
    const entry = {
      date,
      ingresos: Number(q("e-ingresos").value) || 0,
      costos: Number(q("e-costos").value) || 0,
      gastos: Number(q("e-gastos").value) || 0,
      pagoDeuda: Number(q("e-pagodeuda").value) || 0,
      prestamoNuevo: Number(q("e-prestamo").value) || 0,
      retiroPersonal: Number(q("e-retiro").value) || 0,
      aportePersonal: Number(q("e-aporte").value) || 0,
    };
    const existingIdx = session.entries.findIndex((e) => e.date === date);
    if (existingIdx > -1) {
      if (!confirm("Ya existe un registro para " + date + ". ¿Reemplazarlo?")) return;
      session.entries[existingIdx] = entry;
    } else {
      session.entries.push(entry);
    }

    const msg = q("entry-msg");
    msg.hidden = false;
    if (!dbApi) {
      msg.className = "form-msg err";
      msg.textContent = SIN_CONEXION_MSG;
      return;
    }
    msg.className = "form-msg";
    msg.textContent = "Guardando…";
    try {
      await dbApi.saveNegocio(session.id, {
        nombre: session.nombre,
        config: session.config,
        entries: session.entries,
      });
      msg.className = "form-msg ok";
      msg.textContent = "Registro guardado.";
      q("form-entry").reset();
      q("e-date").value = todayISO();
      renderRecent();
    } catch (e) {
      msg.className = "form-msg err";
      msg.textContent = "No se pudo guardar: " + e.message;
    }
  });
}

function renderRecent() {
  if (!session) return;
  const sorted = session.entries.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5);
  const body = q("recent-body");
  body.innerHTML = "";
  sorted.forEach((e) => {
    const cg = (Number(e.costos) || 0) + (Number(e.gastos) || 0);
    const utilidad = (Number(e.ingresos) || 0) - cg;
    const tr = document.createElement("tr");
    tr.innerHTML =
      "<td>" + e.date + "</td>" +
      '<td class="num">' + fmt(e.ingresos) + "</td>" +
      '<td class="num">' + fmt(cg) + "</td>" +
      '<td class="num ' + (utilidad < 0 ? "neg" : "pos") + '">' + fmt(utilidad) + "</td>";
    body.appendChild(tr);
  });
}

// ---------- Resultados ----------
function renderResultados() {
  if (!session) return;
  const m = computeSeries(session);
  const sem = semaforoDe(m);

  const dot = q("sem-dot");
  dot.className = "sem-dot " + sem.nivel;
  const title = q("sem-title");
  title.className = "sem-title " + sem.nivel;
  title.textContent = sem.titulo;
  q("sem-msg").textContent = sem.msg;
  q("sem-reco").textContent = sem.reco;

  const signals = q("signals");
  signals.innerHTML = "";
  const sigData = [
    ["Patrimonio", fmt(m.patrimonio)],
    ["Colchón de caja", isFinite(m.colchon) ? Math.floor(m.colchon) + " días" : "—"],
    ["Endeudamiento", m.endeudamiento.toFixed(1) + "%"],
    ["Retiros vs. utilidad", fmt(m.retirosAcum) + " de " + fmt(m.utilidadAcum)],
  ];
  sigData.forEach(([k, v]) => {
    const li = document.createElement("li");
    li.innerHTML = "<span>" + k + "</span><span>" + v + "</span>";
    signals.appendChild(li);
  });

  const activos = m.activos || 0;
  const pasivos = m.pasivos || 0;
  const patrimonio = m.patrimonio || 0;
  const pasivosPct = activos > 0 ? Math.max(0, Math.min(100, (pasivos / activos) * 100)) : 0;
  q("seg-liab").style.width = pasivosPct + "%";
  q("seg-equity").style.width = 100 - pasivosPct + "%";
  q("bal-pasivos").textContent = fmt(pasivos);
  q("bal-patrimonio").textContent = fmt(patrimonio);
  q("bal-activos").textContent = fmt(activos);
  const diff = Math.round(patrimonio - m.patrimonioCheck);
  q("check-note").textContent =
    Math.abs(diff) < 1
      ? "Las cuentas cuadran: coincide con capital + utilidad − retiros."
      : "Ojo: hay una diferencia de " + fmt(Math.abs(diff)) + " entre el patrimonio calculado y la verificación — revisa que todos los movimientos estén bien registrados.";

  renderTrend(m.rows);
  renderHistTable(m.rows);
}

function renderHistTable(rows) {
  const body = q("hist-body");
  body.innerHTML = "";
  rows
    .slice()
    .reverse()
    .forEach((r) => {
      const e = r.entry;
      const cg = (Number(e.costos) || 0) + (Number(e.gastos) || 0);
      const tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + e.date + "</td>" +
        '<td class="num">' + fmt(e.ingresos) + "</td>" +
        '<td class="num">' + fmt(cg) + "</td>" +
        '<td class="num ' + (r.utilidad < 0 ? "neg" : "pos") + '">' + fmt(r.utilidad) + "</td>" +
        '<td class="num ' + (r.saldoDia < 0 ? "neg" : "pos") + '">' + fmt(r.saldoDia) + "</td>" +
        '<td class="num">' + fmt(r.saldoAcum) + "</td>" +
        '<td><button class="row-del" data-date="' + e.date + '" title="Eliminar">✕</button></td>';
      body.appendChild(tr);
    });
  body.querySelectorAll(".row-del").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const date = btn.getAttribute("data-date");
      if (!confirm("¿Eliminar el registro de " + date + "?")) return;
      const backup = session.entries;
      session.entries = session.entries.filter((e) => e.date !== date);
      if (!dbApi) {
        alert(SIN_CONEXION_MSG);
        session.entries = backup;
        return;
      }
      try {
        await dbApi.saveNegocio(session.id, {
          nombre: session.nombre,
          config: session.config,
          entries: session.entries,
        });
        renderResultados();
      } catch (e) {
        alert("No se pudo eliminar el registro: " + e.message);
        session.entries = backup;
      }
    });
  });
}

function renderTrend(rows) {
  const svg = q("trend-svg");
  svg.innerHTML = "";
  if (!rows.length) return;
  const W = 600, H = 220, PAD = 30;
  const values = rows.map((r) => r.saldoAcum);
  const min = Math.min(0, ...values);
  const max = Math.max(...values, 1);
  const range = max - min || 1;
  const stepX = rows.length > 1 ? (W - PAD * 2) / (rows.length - 1) : 0;
  const pts = values.map((v, i) => {
    const x = PAD + i * stepX;
    const y = H - PAD - ((v - min) / range) * (H - PAD * 2);
    return [x, y];
  });

  const ns = "http://www.w3.org/2000/svg";
  // grid lines
  for (let g = 0; g <= 3; g++) {
    const y = PAD + (g * (H - PAD * 2)) / 3;
    const line = document.createElementNS(ns, "line");
    line.setAttribute("x1", PAD);
    line.setAttribute("x2", W - PAD);
    line.setAttribute("y1", y);
    line.setAttribute("y2", y);
    line.setAttribute("stroke", "currentColor");
    line.setAttribute("stroke-opacity", "0.12");
    svg.appendChild(line);
  }

  const pathD = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
  const areaD = pathD + " L" + pts[pts.length - 1][0].toFixed(1) + "," + (H - PAD) + " L" + pts[0][0].toFixed(1) + "," + (H - PAD) + " Z";

  const area = document.createElementNS(ns, "path");
  area.setAttribute("d", areaD);
  area.setAttribute("fill", "var(--balance-equity)");
  area.setAttribute("fill-opacity", "0.15");
  area.setAttribute("stroke", "none");
  svg.appendChild(area);

  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", pathD);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "var(--balance-equity)");
  path.setAttribute("stroke-width", "2.5");
  svg.appendChild(path);

  const last = pts[pts.length - 1];
  const dot = document.createElementNS(ns, "circle");
  dot.setAttribute("cx", last[0]);
  dot.setAttribute("cy", last[1]);
  dot.setAttribute("r", "5");
  dot.setAttribute("fill", "var(--balance-equity)");
  svg.appendChild(dot);

  const hitArea = document.createElementNS(ns, "rect");
  hitArea.setAttribute("x", 0);
  hitArea.setAttribute("y", 0);
  hitArea.setAttribute("width", W);
  hitArea.setAttribute("height", H);
  hitArea.setAttribute("fill", "transparent");
  svg.appendChild(hitArea);

  const tooltip = q("trend-tooltip");
  hitArea.addEventListener("mousemove", (evt) => {
    const rect = svg.getBoundingClientRect();
    const relX = ((evt.clientX - rect.left) / rect.width) * W;
    let idx = Math.round((relX - PAD) / (stepX || 1));
    idx = Math.max(0, Math.min(pts.length - 1, idx));
    const p = pts[idx];
    const scaleX = rect.width / W;
    const scaleY = rect.height / H;
    tooltip.hidden = false;
    tooltip.style.left = p[0] * scaleX + "px";
    tooltip.style.top = p[1] * scaleY + "px";
    tooltip.textContent = rows[idx].entry.date + ": " + fmt(values[idx]);
  });
  hitArea.addEventListener("mouseleave", () => {
    tooltip.hidden = true;
  });
}

// ---------- Asesor financiero ----------
function renderAsesor() {
  if (!session) return;
  const m = computeSeries(session);
  const sem = semaforoDe(m);
  const cap = capacidadCredito(m, sem);

  q("cap-cuota").textContent = fmt(cap.cuotaMaxima);
  q("cap-motivo").textContent = cap.motivo;

  renderTips(m, sem);

  // guardar para el simulador
  q("form-sim").dataset.cuotaMaxima = cap.cuotaMaxima;
}

function wireSimForm() {
  q("form-sim").addEventListener("submit", (evt) => {
    evt.preventDefault();
    const monto = Number(q("sim-monto").value) || 0;
    const tasa = Number(q("sim-tasa").value) || 0;
    const plazo = Number(q("sim-plazo").value) || 0;
    const sim = simularCredito(monto, tasa, plazo);
    const box = q("sim-result");
    if (!sim) {
      box.hidden = false;
      box.className = "sim-result no-viable";
      box.innerHTML = "<h4>Revisa los datos</h4><p>El monto y el plazo deben ser mayores a cero.</p>";
      return;
    }
    const cuotaMaxima = Number(q("form-sim").dataset.cuotaMaxima) || 0;
    const viable = esViable(sim.cuota, cuotaMaxima);
    box.hidden = false;
    box.className = "sim-result " + (viable ? "viable" : "no-viable");
    box.innerHTML =
      "<h4>" +
      (viable
        ? "Sí parece factible con tus movimientos actuales"
        : "No es recomendable con tus movimientos actuales") +
      "</h4>" +
      "<dl>" +
      "<dt>Cuota mensual</dt><dd>" + fmt(sim.cuota) + "</dd>" +
      "<dt>Tu cuota máxima recomendada</dt><dd>" + fmt(cuotaMaxima) + "</dd>" +
      "<dt>Total a pagar</dt><dd>" + fmt(sim.totalPagado) + "</dd>" +
      "<dt>Total en intereses</dt><dd>" + fmt(sim.totalIntereses) + "</dd>" +
      "</dl>" +
      "<p class=\"field-help\">Estimación educativa — la entidad de crédito puede evaluar tu capacidad de pago de forma distinta.</p>";
  });
}

function renderTips(m, sem) {
  const tips = [];
  if (sem.nivel === "rojo") {
    tips.push("Pausa nuevas deudas y compras grandes hasta que tu semáforo mejore.");
  }
  if (m.colchon < 15) {
    tips.push("Aparta una pequeña parte de cada venta como colchón de caja, aunque sea poco cada día.");
  }
  if (m.endeudamiento > 40) {
    tips.push("Antes de pedir un nuevo préstamo, prioriza pagar las deudas actuales.");
  }
  if (m.retirosAcum > m.utilidadAcum) {
    tips.push("Compara cuánto retiras cada semana contra cuánto gana de verdad el negocio — separar tus cuentas personales ayuda a verlo con claridad.");
  }
  tips.push("Registra todos los días, aunque sea un dato aproximado — entre más completo el historial, más confiable es cada resultado.");
  const list = q("tips-list");
  list.innerHTML = "";
  tips.forEach((t) => {
    const li = document.createElement("li");
    li.textContent = t;
    list.appendChild(li);
  });
}

// ---------- Admin ----------
function wireAdmin() {
  q("btn-admin-enter").addEventListener("click", () => {
    const code = q("admin-code").value;
    const msg = q("admin-msg");
    if (code !== ADMIN_CODE) {
      msg.hidden = false;
      msg.className = "form-msg err";
      msg.textContent = "Código incorrecto.";
      return;
    }
    q("admin-gate").hidden = true;
    q("admin-panel").hidden = false;
    loadAdminList();
  });
  q("btn-admin-refresh").addEventListener("click", loadAdminList);
}

async function loadAdminList() {
  const body = q("admin-body");
  body.innerHTML = '<tr><td colspan="6">Cargando…</td></tr>';
  if (!dbApi) {
    body.innerHTML = '<tr><td colspan="6">' + SIN_CONEXION_MSG + "</td></tr>";
    return;
  }
  try {
    const negocios = await dbApi.listNegocios();
    body.innerHTML = "";
    if (!negocios.length) {
      body.innerHTML = '<tr><td colspan="6">Aún no hay negocios registrados.</td></tr>';
      return;
    }
    negocios.forEach(({ id, data }) => {
      const state = { config: normalizeConfig(data.config), entries: data.entries || [] };
      const m = computeSeries(state);
      const sem = semaforoDe(m);
      const tr = document.createElement("tr");
      tr.style.cursor = "pointer";
      tr.innerHTML =
        "<td>" + (data.nombre || id) + "</td>" +
        '<td><span class="sem-dot ' + sem.nivel + '" style="display:inline-block;width:0.8rem;height:0.8rem;vertical-align:middle;margin-right:0.4rem;"></span>' + sem.titulo + "</td>" +
        '<td class="num">' + fmt(m.patrimonio) + "</td>" +
        '<td class="num">' + (isFinite(m.colchon) ? Math.floor(m.colchon) : "—") + "</td>" +
        '<td class="num">' + m.nDays + "</td>" +
        "<td>" + (data.updatedAt ? new Date(data.updatedAt).toLocaleString("es-CO") : "—") + "</td>";
      tr.addEventListener("click", () => showAdminDetail(id, data, m, sem));
      body.appendChild(tr);
    });
  } catch (e) {
    body.innerHTML = '<tr><td colspan="6">No se pudo cargar: ' + e.message + "</td></tr>";
  }
}

function showAdminDetail(id, data, m, sem) {
  const box = q("admin-detail");
  box.hidden = false;
  box.innerHTML =
    "<h3>" + (data.nombre || id) + "</h3>" +
    "<p><strong>" + sem.titulo + "</strong> — " + sem.msg + "</p>" +
    "<p>Activos: " + fmt(m.activos) + " · Pasivos: " + fmt(m.pasivos) + " · Patrimonio: " + fmt(m.patrimonio) + "</p>" +
    "<p>Colchón de caja: " + (isFinite(m.colchon) ? Math.floor(m.colchon) + " días" : "—") + " · Endeudamiento: " + m.endeudamiento.toFixed(1) + "%</p>" +
    "<p>Días registrados: " + m.nDays + " · Última actualización: " + (data.updatedAt ? new Date(data.updatedAt).toLocaleString("es-CO") : "—") + "</p>";
  box.scrollIntoView({ behavior: "smooth" });
}

// ---------- tema ----------
function initTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) document.documentElement.setAttribute("data-theme", saved);
  } catch (e) {
    /* noop */
  }
}
function wireTheme() {
  q("btn-theme").addEventListener("click", () => {
    const root = document.documentElement;
    const current = root.getAttribute("data-theme");
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    let next;
    if (!current) next = prefersDark ? "light" : "dark";
    else if (current === "dark") next = "light";
    else next = "dark";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (e) {
      /* noop */
    }
  });
}

document.addEventListener("DOMContentLoaded", init);
