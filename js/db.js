// db.js — Todo lo que toca Firebase vive aquí, separado de la lógica de
// negocio (calc.js) y de la interfaz (app.js).

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const COLLECTION = "negocios";

let app = null;
let dbInstance = null;
let initError = null;

export function initFirebase() {
  if (app || initError) return { ok: !!app, error: initError };
  try {
    app = initializeApp(firebaseConfig);
    dbInstance = getFirestore(app);
    return { ok: true, error: null };
  } catch (e) {
    initError = e;
    return { ok: false, error: e };
  }
}

export function slugify(nombre) {
  return (nombre || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita tildes (marcas diacríticas tras NFD)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "negocio";
}

export function docIdFor(nombre, pin) {
  return slugify(nombre) + "-" + String(pin).trim();
}

// Lee un negocio por nombre+PIN. No lanza error si no existe: eso significa
// "negocio nuevo, aún no registrado" y la app debe tratarlo como tal.
export async function loadNegocio(nombre, pin) {
  if (!dbInstance) throw new Error("Firebase no está inicializado.");
  const id = docIdFor(nombre, pin);
  const ref = doc(dbInstance, COLLECTION, id);
  const snap = await getDoc(ref);
  return { id, exists: snap.exists(), data: snap.exists() ? snap.data() : null };
}

export async function saveNegocio(id, data) {
  if (!dbInstance) throw new Error("Firebase no está inicializado.");
  const ref = doc(dbInstance, COLLECTION, id);
  const payload = { ...data, updatedAt: new Date().toISOString() };
  if (!payload.createdAt) payload.createdAt = payload.updatedAt;
  await setDoc(ref, payload, { merge: false });
  return payload;
}

// Para el panel de administrador: trae todos los negocios registrados.
// Pensado para un piloto (decenas de negocios), no para miles de registros.
export async function listNegocios() {
  if (!dbInstance) throw new Error("Firebase no está inicializado.");
  const snap = await getDocs(collection(dbInstance, COLLECTION));
  const out = [];
  snap.forEach((d) => out.push({ id: d.id, data: d.data() }));
  return out;
}
