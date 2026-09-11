// firebase-config.js
//
// PASO 1 de la instalación (ver README.md para la guía completa):
//
// 1. Entra a https://console.firebase.google.com y crea un proyecto nuevo
//    (es gratis). No necesitas tarjeta de crédito para este uso.
// 2. Dentro del proyecto, activa "Firestore Database" (modo producción).
// 3. En Firestore → Reglas, pega las reglas que están en README.md.
// 4. En el proyecto, ve a "Configuración del proyecto" (ícono de engranaje)
//    → en la sección "Tus apps", crea una app web (ícono </>).
// 5. Firebase te va a mostrar un objeto de configuración parecido a este.
//    Cópialo y reemplaza los valores de ejemplo de abajo por los tuyos.
//
// Importante: estos valores NO son secretos — están hechos para vivir en el
// código del navegador. La protección real de los datos vive en las Reglas
// de Firestore (paso 3), no en ocultar este archivo.

export const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:xxxxxxxxxxxxxxxxxxxxxx",
};

// Código de acceso al panel de administrador (pestaña "Programa").
// Cámbialo por uno propio antes de compartir el enlace con el grupo.
// No es una contraseña de verdad — es solo para que no cualquiera abra
// el panel por accidente. Cualquier persona que use la aplicación puede,
// en principio, leerlo si revisa el código — no lo uses para datos
// verdaderamente sensibles.
export const ADMIN_CODE = "palante2026";
