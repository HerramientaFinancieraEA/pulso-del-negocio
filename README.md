# Pulso del Negocio

Herramienta web de flujo de caja para emprendimientos del Programa Pa'lante. Las
emprendedoras registran sus movimientos diarios desde el celular (sin crear
ninguna cuenta), y la herramienta calcula su balance, su semáforo de salud
financiera y una estimación de capacidad de crédito. Los datos quedan
guardados en una base de datos (Firebase Firestore) que tú controlas, así que
puedes ver el progreso de todos los negocios desde un panel de administrador
dentro de la misma herramienta.

Este documento explica, paso a paso y sin dar por hecho que sabes de
programación, cómo poner la herramienta a funcionar en internet.

## Qué vas a necesitar

- Una cuenta de Google (para crear el proyecto de Firebase — es gratis, no
  pide tarjeta de crédito para lo que esta herramienta usa).
- Una cuenta de GitHub (también gratis) — es donde vamos a "colgar" la
  herramienta para que tenga un enlace público.
- Unos 20–30 minutos la primera vez. Después de esta configuración inicial,
  no necesitas tocar nada más para que la herramienta siga funcionando.

## Parte 1 — Crear la base de datos (Firebase)

Firebase es el servicio (de Google) donde se van a guardar los registros de
cada negocio. Es gratis para el tamaño de un piloto como este.

1. Entra a [console.firebase.google.com](https://console.firebase.google.com)
   con tu cuenta de Google.
2. Haz clic en **"Crear un proyecto"**. Ponle un nombre, por ejemplo
   `palante-pulso-negocio`. Puedes desactivar Google Analytics si te lo
   ofrece (no lo necesitas).
3. Cuando el proyecto esté listo, en el menú de la izquierda busca
   **"Compilación" → "Firestore Database"** y haz clic en **"Crear base de
   datos"**.
   - Elige una ubicación cercana (por ejemplo `southamerica-east1`).
   - Elige **"Iniciar en modo de producción"**.
4. Ve a la pestaña **"Reglas"** dentro de Firestore. Vas a ver un editor de
   texto. Borra todo lo que haya ahí y pega el contenido completo del
   archivo [`firestore.rules`](./firestore.rules) que viene en esta carpeta.
   Haz clic en **"Publicar"**.
   - Estas reglas limitan la base de datos a la colección `negocios` y
     validan que cada registro tenga la forma esperada. Léelas — tienen
     comentarios que explican qué protegen y qué no (ver la sección de
     Privacidad más abajo).
5. Ahora ve a **"Configuración del proyecto"** (el ícono de engranaje ⚙️,
   arriba a la izquierda, junto a "Descripción general del proyecto").
6. Baja hasta **"Tus apps"** y haz clic en el ícono `</>` (Web) para crear
   una app web. Ponle un apodo, por ejemplo `pulso-web` (no marques
   "Firebase Hosting", no lo necesitas).
7. Firebase te va a mostrar un bloque de código con algo llamado
   `firebaseConfig`, parecido a esto:

   ```js
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "palante-pulso-negocio.firebaseapp.com",
     projectId: "palante-pulso-negocio",
     storageBucket: "palante-pulso-negocio.appspot.com",
     messagingSenderId: "123456789000",
     appId: "1:123456789000:web:abcabcabcabc",
   };
   ```

   Copia esos valores. Ábrelos junto al archivo `js/firebase-config.js` de
   esta carpeta y reemplaza los valores de ejemplo (`TU_API_KEY`,
   `tu-proyecto`, etc.) por los tuyos, manteniendo las comillas.

Con esto, la base de datos ya está lista.

## Parte 2 — Cambiar el código del panel de administrador

Abre también `js/firebase-config.js` y busca la línea:

```js
export const ADMIN_CODE = "palante2026";
```

Cámbiala por un código propio, por ejemplo el nombre del programa más un
número que solo tú conozcas. Este es el código que vas a escribir en la
pestaña **"Programa"** de la herramienta para ver todos los negocios
registrados. No es una contraseña robusta (cualquiera que revise el código
de la página puede encontrarla) — más bien evita que un participante entre
por accidente al panel. No la uses para nada más sensible que esto.

## Parte 3 — Publicar la herramienta en internet (GitHub Pages)

1. Entra a [github.com](https://github.com) e inicia sesión (o crea una
   cuenta gratuita).
2. Haz clic en el botón **"+"** (arriba a la derecha) → **"New repository"**.
   - Nombre sugerido: `pulso-del-negocio`.
   - Marca **"Public"** (tiene que ser público para que GitHub Pages lo
     publique gratis).
   - No marques ninguna otra opción. Haz clic en **"Create repository"**.
3. En la página del repositorio recién creado, busca el enlace
   **"uploading an existing file"** (o el botón "Add file" → "Upload
   files").
4. Arrastra **todos los archivos y carpetas de esta entrega** (`index.html`,
   la carpeta `css`, la carpeta `js`, `firestore.rules`, este `README.md`)
   a esa pantalla, y haz clic en **"Commit changes"**.
5. Ve a la pestaña **"Settings"** del repositorio → en el menú de la
   izquierda, **"Pages"**.
   - En "Branch", elige `main` (o `master`) y la carpeta `/ (root)`.
   - Haz clic en **"Save"**.
6. Espera uno o dos minutos y recarga la página. GitHub te va a mostrar un
   enlace parecido a `https://tu-usuario.github.io/pulso-del-negocio/` — ese
   es el enlace que puedes compartir con las emprendedoras del programa.

## Cómo usar el panel de administrador

Una vez que la herramienta esté publicada:

1. Abre el enlace de tu herramienta.
2. Ve a la pestaña **"Programa"** (a la derecha de la barra de pestañas).
3. Escribe el código de administrador que pusiste en la Parte 2.
4. Vas a ver la lista de todos los negocios registrados: su semáforo, su
   patrimonio, sus días registrados y la última vez que actualizaron su
   registro. Haz clic en una fila para ver el detalle de ese negocio.

## Privacidad — qué protege esta configuración y qué no

Para que las emprendedoras no tengan que crear una cuenta en ninguna
plataforma, esta herramienta usa el nombre del negocio + un código de 4
dígitos (que cada una inventa) como su forma de "entrar" a su registro —
no es un usuario/contraseña real gestionado por un sistema de cuentas.

En la práctica, esto significa:

- Cualquier persona que adivine el nombre exacto y el código de 4 dígitos de
  un negocio podría ver o modificar su registro. Con nombres de negocio
  variados y 10,000 códigos posibles, esto es una barrera razonable para un
  piloto, pero no es una garantía de seguridad como la de un banco.
- Anímalas a elegir un código que no sea obvio (no `0000` ni `1234`) y a
  guardarlo en un lugar seguro.
- Si más adelante el programa crece y necesitas una protección más fuerte
  (usuario y contraseña reales, recuperación de contraseña, etc.), esto se
  puede migrar a Firebase Authentication — es un cambio adicional, avísame
  si quieres que lo preparemos.

Estos datos son financieros y siguen siendo sensibles aunque no haya nombres
completos ni documentos de identidad — trata el acceso al panel de
administrador (y el código de administrador) con el mismo cuidado que le
darías a cualquier otra información del programa.

## Costos

Para un piloto de decenas de negocios con registros diarios, el uso se queda
cómodamente dentro de la capa gratuita de Firebase ("Spark") y de GitHub
Pages — no deberías pagar nada. Si el programa crece a cientos de negocios
activos, vale la pena revisar el uso en la consola de Firebase de vez en
cuando.

## Si algo no funciona

- **La página carga pero al iniciar sesión dice "No se pudo conectar con el
  almacenamiento en la nube"**: revisa que copiaste bien los valores en
  `js/firebase-config.js` (sin dejar `TU_API_KEY` ni comillas de más).
- **La página se ve en blanco**: asegúrate de haber subido también las
  carpetas `css` y `js` completas a GitHub, no solo el `index.html`.
- **El panel de administrador dice "Código incorrecto"**: revisa que estás
  escribiendo el mismo código que pusiste en `ADMIN_CODE` dentro de
  `js/firebase-config.js`.

## Estructura de este proyecto

```
index.html            La página (todas las pestañas)
css/styles.css         Estilos visuales
js/app.js               Lógica de la interfaz y navegación entre pestañas
js/calc.js               Cálculos financieros (semáforo, balance, crédito)
js/db.js                  Conexión con Firebase Firestore
js/firebase-config.js      Tu configuración de Firebase y el código de admin
firestore.rules          Reglas de seguridad para pegar en Firebase
```
