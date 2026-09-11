// calc.js — Lógica financiera de Pulso del Negocio.
// Módulo puro (sin DOM, sin Firebase) para que sea fácil de probar y auditar.

export function sumList(list) {
  return (list || []).reduce((a, b) => a + (Number(b.value) || 0), 0);
}

// Recalcula toda la serie de un negocio a partir de su configuración inicial
// y sus registros diarios. Reglas exactamente como se explicaron en la sesión:
//   Utilidad del día = Ingresos - Costos - Gastos
//   Saldo de caja del día = Utilidad - Pago de deudas - Retiro personal
//                           + Aporte personal + Préstamo nuevo
export function computeSeries(state) {
  const cfg = state.config;
  const entries = (state.entries || [])
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  let cash = Number(cfg.cash) || 0;
  let deuda = sumList(cfg.debts);
  let utilidadAcum = 0;
  let retirosAcum = 0;
  let aporteAcum = 0;
  const rows = [];

  entries.forEach((e) => {
    const ingresos = Number(e.ingresos) || 0;
    const costos = Number(e.costos) || 0;
    const gastos = Number(e.gastos) || 0;
    const pagoDeuda = Number(e.pagoDeuda) || 0;
    const retiro = Number(e.retiroPersonal) || 0;
    const aporte = Number(e.aportePersonal) || 0;
    const prestamo = Number(e.prestamoNuevo) || 0;

    const utilidad = ingresos - costos - gastos;
    const saldoDia = utilidad - pagoDeuda - retiro + aporte + prestamo;

    cash += saldoDia;
    deuda += prestamo - pagoDeuda;
    utilidadAcum += utilidad;
    retirosAcum += retiro;
    aporteAcum += aporte;

    rows.push({ entry: e, utilidad, saldoDia, saldoAcum: cash, deudaAcum: deuda });
  });

  const fixedAssetsTotal = sumList(cfg.assets);
  const activos = cash + (Number(cfg.inventory) || 0) + fixedAssetsTotal;
  const pasivos = deuda;
  const patrimonio = activos - pasivos;
  const capitalTotal = (Number(cfg.capital) || 0) + aporteAcum;
  const patrimonioCheck = capitalTotal + utilidadAcum - retirosAcum;

  const nDays = entries.length;
  const costosGastosSum = entries.reduce(
    (a, e) => a + (Number(e.costos) || 0) + (Number(e.gastos) || 0),
    0
  );
  const avgDailyCostosGastos = nDays > 0 ? costosGastosSum / nDays : 0;
  const colchon =
    avgDailyCostosGastos > 0 ? cash / avgDailyCostosGastos : cash > 0 ? Infinity : 0;
  const endeudamiento = activos > 0 ? (pasivos / activos) * 100 : pasivos > 0 ? 999 : 0;

  const avgDailyUtilidad = nDays > 0 ? utilidadAcum / nDays : 0;
  const avgDailyRetiro = nDays > 0 ? retirosAcum / nDays : 0;

  let utilidadNegSostenida = false;
  if (rows.length >= 14) {
    const last7 = rows.slice(-7).reduce((a, r) => a + r.utilidad, 0);
    const prev7 = rows.slice(-14, -7).reduce((a, r) => a + r.utilidad, 0);
    utilidadNegSostenida = last7 < 0 && prev7 < 0;
  }

  return {
    rows,
    activos,
    pasivos,
    patrimonio,
    patrimonioCheck,
    cash,
    colchon,
    endeudamiento,
    utilidadAcum,
    retirosAcum,
    avgDailyUtilidad,
    avgDailyRetiro,
    nDays,
    utilidadNegSostenida,
    fixedAssetsTotal,
  };
}

// Semáforo de salud financiera — mismas reglas explicadas en la sesión.
export function semaforoDe(m) {
  const patrimonioOk = m.patrimonio > 0;
  const deudaCrit = m.endeudamiento > 70;
  const deudaWarn = m.endeudamiento > 40;
  const colchonCrit = m.colchon < 5;
  const colchonWarn = m.colchon < 15;
  const retirosWarn = m.retirosAcum > m.utilidadAcum;

  if (!patrimonioOk || deudaCrit || colchonCrit || m.utilidadNegSostenida) {
    return {
      nivel: "rojo",
      titulo: "Finanzas en riesgo",
      msg: !patrimonioOk
        ? "Lo que debes es más de lo que tienes: tu patrimonio es negativo."
        : m.utilidadNegSostenida
        ? "Llevas varios días seguidos donde gastas más de lo que entra."
        : colchonCrit
        ? "Si dejaras de vender, tu caja no alcanza ni para " +
          Math.max(0, Math.floor(m.colchon)) +
          " días de gastos."
        : "Tus deudas ya son más del 70% de todo lo que tiene el negocio.",
      reco:
        "Antes de comprar más insumos o pedir otro préstamo, revisa tus gastos fijos y tus retiros. Si puedes, pausa los retiros personales hasta estabilizar la caja.",
    };
  }
  if (deudaWarn || colchonWarn || retirosWarn) {
    return {
      nivel: "amarillo",
      titulo: "Atención",
      msg: colchonWarn
        ? "Tu caja alcanza para cerca de " +
          Math.floor(m.colchon) +
          " días de gastos si dejaras de vender — es un colchón corto."
        : deudaWarn
        ? "Tus deudas ya representan el " + m.endeudamiento.toFixed(0) + "% de lo que tiene el negocio."
        : "Estás retirando más de lo que el negocio está ganando.",
      reco:
        "No es crítico, pero conviene vigilarlo de cerca: registra todos los días y evita nuevas deudas hasta ampliar el colchón de caja.",
    };
  }
  return {
    nivel: "verde",
    titulo: "Finanzas sanas",
    msg: "Tu patrimonio es positivo, tus deudas están controladas y tienes colchón de caja de sobra.",
    reco: "Vas bien. Sigue registrando todos los días para detectar a tiempo cualquier cambio.",
  };
}

// ---------- Asesor financiero ----------

// Capacidad de endeudamiento: estimación EDUCATIVA, conservadora por diseño.
// Regla acordada con el programa: la cuota máxima recomendada es el 20% de
// la "utilidad libre mensual" (utilidad promedio menos lo que la persona ya
// retira para vivir), y baja a $0 si el semáforo está en rojo.
export function capacidadCredito(m, semaforo) {
  const utilidadLibreMensual = Math.max(
    (m.avgDailyUtilidad - m.avgDailyRetiro) * 30,
    0
  );
  const PORC_CONSERVADOR = 0.2;
  let cuotaMaxima = utilidadLibreMensual * PORC_CONSERVADOR;
  let motivo = "";
  if (semaforo.nivel === "rojo") {
    cuotaMaxima = 0;
    motivo =
      "Tu semáforo está en rojo — con datos suficientes, no se recomienda asumir una deuda nueva hasta estabilizar el negocio.";
  } else if (semaforo.nivel === "amarillo") {
    motivo =
      "Tu semáforo está en amarillo — esta cifra es conservadora a propósito; conviene no comprometerla toda.";
  } else {
    motivo =
      "Tu semáforo está en verde — esta es una cifra conservadora (20% de tu utilidad libre mensual).";
  }
  return { utilidadLibreMensual, cuotaMaxima, motivo };
}

// Simulador de crédito — amortización de cuota fija (sistema francés).
// tasaMensualPct: tasa de interés mensual en porcentaje (ej. 2.5 = 2.5%).
export function simularCredito(monto, tasaMensualPct, plazoMeses) {
  const P = Number(monto) || 0;
  const n = Math.max(0, Math.round(Number(plazoMeses) || 0));
  const i = (Number(tasaMensualPct) || 0) / 100;
  if (P <= 0 || n <= 0) return null;

  let cuota;
  if (i === 0) {
    cuota = P / n;
  } else {
    cuota = (P * i) / (1 - Math.pow(1 + i, -n));
  }
  const totalPagado = cuota * n;
  const totalIntereses = totalPagado - P;
  return { cuota, totalPagado, totalIntereses, n, monto: P, tasaMensualPct: i * 100 };
}

export function esViable(cuota, cuotaMaxima) {
  if (!(cuotaMaxima > 0)) return false;
  return cuota <= cuotaMaxima;
}
