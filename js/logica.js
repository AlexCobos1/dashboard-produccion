/* ==================================================================
   logica.js — Estado, almacenamiento y reglas de negocio
   ================================================================== */

/* ---------------- 1. ESTADO EN MEMORIA Y LLAVES DE GUARDADO ----------------
   Aquí definimos las variables globales de la aplicación y los nombres
   con los que se guardarán en la base de datos (Firebase).
   Si cambias las llaves (STORAGE_KEY), empezarás con una base de datos en blanco.
------------------------------------------------------------------------- */
const state = {
  programacion: [],
  historico: [],
  historialOps: [],
  cortesTurno: [],
  horariosAlim: {}, // NUEVO: Guarda los horarios de alimentación configurados desde la app
  usuario: '',
  totalUnidadesTeoricas: 0
};

const STORAGE_KEY_PROG = 'sp_programacion_v1';
const STORAGE_KEY_HIST = 'sp_historico_v1';
const STORAGE_KEY_USER = 'sp_usuario_v1';
const STORAGE_KEY_TOTAL_TEORICO = 'sp_total_teorico_v1';
const STORAGE_KEY_CORTES = 'sp_cortes_turno_v1';
const STORAGE_KEY_HISTORIAL_OPS = 'sp_historial_ops_v1';
const STORAGE_KEY_ALIMENTACION = 'sp_alimentacion_v1'; // NUEVO: Llave para guardar horarios

/* ---------------- 2. CONEXIÓN A FIREBASE ----------------
   Estas son las credenciales de tu servidor en la nube.
   Si algún día cambias de cuenta de Google/Firebase, debes reemplazar esto.
------------------------------------------------------- */
const firebaseConfig = {
  apiKey: "AIzaSyABgoxELml0chya1waw0mFEeLX5oysfa2c",
  authDomain: "mes-produccion-tocancipa.firebaseapp.com",
  databaseURL: "https://mes-produccion-tocancipa-default-rtdb.firebaseio.com",
  projectId: "mes-produccion-tocancipa",
  storageBucket: "mes-produccion-tocancipa.firebasestorage.app",
  messagingSenderId: "748547004390",
  appId: "1:748547004390:web:4c4a27eeba8d0795592827",
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

/* ---------------- 3. FUNCIONES DE LECTURA Y ESCRITURA EN NUBE ---------------- */
async function storageGet(key){
  try {
    const snapshot = await db.ref(key).once('value');
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) {
    console.error(`Error leyendo ${key} de Firebase:`, error);
    return null;
  }
}

async function storageSet(key, value){
  try {
    await db.ref(key).set(value);
    return true;
  } catch (error) {
    console.error(`Error guardando ${key} en Firebase:`, error);
    return false;
  }
}

/* Funciones rápidas para guardar cada módulo por separado */
function guardarProgramacion(){ return storageSet(STORAGE_KEY_PROG, JSON.stringify(state.programacion)); }
function guardarHistorico(){ return storageSet(STORAGE_KEY_HIST, JSON.stringify(state.historico)); }
function guardarUsuario(){ return storageSet(STORAGE_KEY_USER, state.usuario || ''); }
function guardarTotalTeorico(){ return storageSet(STORAGE_KEY_TOTAL_TEORICO, String(state.totalUnidadesTeoricas || 0)); }
function guardarCortesTurno(){ return storageSet(STORAGE_KEY_CORTES, JSON.stringify(state.cortesTurno)); }
function guardarHistorialOps(){ return storageSet(STORAGE_KEY_HISTORIAL_OPS, JSON.stringify(state.historialOps)); }
function guardarHorariosAlim(){ return storageSet(STORAGE_KEY_ALIMENTACION, JSON.stringify(state.horariosAlim)); } // NUEVO

function seedProgramacionSiVacio(){
  state.programacion = SEED_PROGRAMACION.map(p => ({...p}));
}

/* ---------------- 4. INICIALIZACIÓN DEL SISTEMA ----------------
   Esta función arranca cuando la página carga. Descarga todos los datos
   de Firebase y los mete en la variable "state" para que la app sea rápida.
----------------------------------------------------------------- */
async function inicializarEstado(){
  const [
    progRaw, histRaw, userRaw, totalTeoricoRaw, cortesRaw, historialOpsRaw, alimentacionRaw
  ] = await Promise.all([
    storageGet(STORAGE_KEY_PROG),
    storageGet(STORAGE_KEY_HIST),
    storageGet(STORAGE_KEY_USER),
    storageGet(STORAGE_KEY_TOTAL_TEORICO),
    storageGet(STORAGE_KEY_CORTES),
    storageGet(STORAGE_KEY_HISTORIAL_OPS),
    storageGet(STORAGE_KEY_ALIMENTACION) // NUEVO
  ]);

  // Carga de Programación
  try { state.programacion = progRaw ? JSON.parse(progRaw) : []; } 
  catch (error) { state.programacion = []; }

  // Carga de Histórico
  try { state.historico = histRaw ? JSON.parse(histRaw) : []; } 
  catch (error) { state.historico = []; }

  // Validaciones de seguridad para evitar errores si la base de datos está vacía
  if (!Array.isArray(state.programacion)){
    state.programacion = [];
    await guardarProgramacion();
  }
  state.programacion.forEach(function(op){
    if (typeof op.cerrada === 'undefined') op.cerrada = false;
    if (typeof op.iniciada === 'undefined') op.iniciada = false;
    if (typeof op.fechaCierre === 'undefined') op.fechaCierre = null;
    if (typeof op.cerradaPor === 'undefined') op.cerradaPor = null;
  });

  if (!Array.isArray(state.historico)){
    state.historico = [];
    await guardarHistorico();
  }

  state.usuario = userRaw || '';
  state.totalUnidadesTeoricas = Number(totalTeoricoRaw || 0);

  // Carga de Cortes de Turno y Tiempos Físicos
  try{ state.cortesTurno = cortesRaw ? JSON.parse(cortesRaw) : []; }
  catch{ state.cortesTurno = []; }

  try{ state.historialOps = historialOpsRaw ? JSON.parse(historialOpsRaw) : []; }
  catch{ state.historialOps = []; }

  // Si en la nube no hay nada guardado, se aplicarán estos valores predeterminados (Ej: 11:10)
  // NUEVO: CARGAR HORARIOS DE ALIMENTACIÓN POR DEFECTO
  // Si en la nube no hay nada guardado, se aplicarán estos valores predeterminados
  try {
    state.horariosAlim = alimentacionRaw ? JSON.parse(alimentacionRaw) : {
      lv_t1_g1: '11:10', lv_t1_g2: '11:20', lv_t2_g1: '', lv_t2_g2: '', lv_t3_g1: '', lv_t3_g2: '',
      s_t1_g1: '10:00',  s_t1_g2: '10:10', s_t2_g1: '',  s_t2_g2: '', s_t3_g1: '',  s_t3_g2: '',
      // Domingos añadidos al estado inicial
      d_t1_g1: '', d_t1_g2: '', d_t2_g1: '', d_t2_g2: '', d_t3_g1: '', d_t3_g2: ''
    };
  } catch {
    // Respaldo de seguridad en caso de que el JSON de Firebase falle
    state.horariosAlim = { 
      lv_t1_g1: '11:10', lv_t1_g2: '11:20', 
      s_t1_g1: '10:00', s_t1_g2: '10:10',
      d_t1_g1: '', d_t1_g2: '' 
    };
  }

/* ---------------- 5. UTILIDADES Y FORMATOS DE TEXTO ---------------- */
const fmtInt   = n => Math.round(n||0).toLocaleString('es-CO');
const fmtDec   = (n,d=1) => (n||0).toLocaleString('es-CO', {minimumFractionDigits:d, maximumFractionDigits:d});
const fmtPct0  = n => Math.round((n||0)*100) + '%';
const fmtPct1  = n => ((n||0)*100).toLocaleString('es-CO', {minimumFractionDigits:1, maximumFractionDigits:1}) + '%';

function horaDecimalATexto(h){
  h = ((h % 24) + 24) % 24;
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  const hh2 = mm === 60 ? hh+1 : hh;
  const mm2 = mm === 60 ? 0 : mm;
  return String(hh2 % 24).padStart(2,'0') + ':' + String(mm2).padStart(2,'0');
}
function toDecimalHour(date){ return date.getHours() + date.getMinutes()/60 + date.getSeconds()/3600; }
function fechaISO(date){
  const y=date.getFullYear(), m=String(date.getMonth()+1).padStart(2,'0'), d=String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}
function obtenerFechaOperativa(fechaHora){
  const fecha = new Date(fechaHora);
  // Las horas de 00:00 a 13:59 pertenecen operativamente al día anterior según tu regla.
  // Puedes ajustar el "14" si el cambio de día operativo cambia de horario.
  if (fecha.getHours() < 14){
    fecha.setDate(fecha.getDate() - 1);
  }
  return fechaISO(fecha);
}
function fechaTexto(iso){
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function horaTexto(date){
  return String(date.getHours()).padStart(2,'0')+':'+String(date.getMinutes()).padStart(2,'0')+':'+String(date.getSeconds()).padStart(2,'0');
}
function horaDeRegistro(hStr){ return parseInt(hStr.split(':')[0],10); }
function uid(){ return 'r'+Date.now().toString(36)+Math.random().toString(36).slice(2,7); }

function buscarProgramacion(linea, op){
  const l = (linea||'').trim().toUpperCase();
  const o = (op==null? '': String(op)).trim();
  return state.programacion.find(p => p.linea.trim().toUpperCase()===l && String(p.op).trim()===o) || null;
}

function registrarInicioTramoOP(prog, fechaInicio){
  const existe = state.historialOps.find(function(item){
    return (item.linea === prog.linea && item.op === prog.op && item.finReal === null);
  });
  if (existe) return;

  state.historialOps.push({
    linea: prog.linea,
    op: prog.op,
    uph: prog.uph,
    inicioReal: fechaInicio,
    finReal: null
  });
  guardarHistorialOps();
}


/* ---------------- 6. LÓGICA DE ALIMENTACIÓN (NUEVO) ----------------
   Si en el futuro añades más líneas a la planta, debes agregarlas
   en la lista 'g1' o 'g2' de aquí abajo para que se les aplique el descuento
   automático de los 50 minutos.
----------------------------------------------------------------- */

function calcularDescuentoAlimentacion(linea, fechaInicio, fechaFin) {
  if (!state.horariosAlim) return 0;
  
  const g1 = ['VERSAFILL', 'MANUAL 1', 'PKB 6', 'MANUAL 2', 'MANUAL 3', 'MRM'];
  const g2 = ['PKB 1', 'PKB 2', 'PKB 3', 'PKB 4', 'PKB 5', 'OMAS', 'PROBADORES'];
  
  const lin = linea.trim().toUpperCase();
  let grupo = g1.includes(lin) ? 1 : (g2.includes(lin) ? 2 : 0);
  if (grupo === 0) return 0; 
  
  let descuentoHoras = 0;
  const diasAComprobar = [new Date(fechaInicio.getFullYear(), fechaInicio.getMonth(), fechaInicio.getDate())];
  const diaFinDate = new Date(fechaFin.getFullYear(), fechaFin.getMonth(), fechaFin.getDate());
  
  if (diasAComprobar[0].getTime() !== diaFinDate.getTime()) {
     diasAComprobar.push(diaFinDate);
  }

  diasAComprobar.forEach(diaBase => {
     
     // Detectar automáticamente qué día de la semana es para aplicar su horario correspondiente
     let pfx = 'lv'; // Lunes a Viernes
     if (diaBase.getDay() === 6) pfx = 's'; // Sábado
     else if (diaBase.getDay() === 0) pfx = 'd'; // Domingo
     
     ['t1', 't2', 't3'].forEach(t => {
        const horaStr = state.horariosAlim[`${pfx}_${t}_g${grupo}`];
        
        // REGLA INTELIGENTE: Si la casilla está vacía (no ingresaste hora), 
        // ignora este turno y no descuenta nada (la cuenta sigue normal).
        if (!horaStr) return; 
        
        const [h, m] = horaStr.split(':').map(Number);
        const inicioPausa = new Date(diaBase);
        inicioPausa.setHours(h, m, 0, 0);
        
        const opcionesPausa = [inicioPausa, new Date(inicioPausa.getTime() + 86400000), new Date(inicioPausa.getTime() - 86400000)];
        opcionesPausa.forEach(pausaInic => {
           const pausaFin = new Date(pausaInic.getTime() + (50 * 60000)); // 50 min de duración
           const maxInicio = new Date(Math.max(fechaInicio, pausaInic));
           const minFin = new Date(Math.min(fechaFin, pausaFin));
           
           if (maxInicio < minFin) {
              descuentoHoras += (minFin - maxInicio) / 3600000; 
           }
        });
     });
  });
  return Math.min(descuentoHoras, 2.5); 
}


/* ---------------- 7. REGISTRO DE PRODUCCIÓN HORA A HORA (CORE) ----------------
   Esta es la función más importante. Recibe las unidades, calcula los acumulados,
   determina el cumplimiento y le descuenta los tiempos de alimentación.
--------------------------------------------------------------------------------- */
function registrarProduccion(opts){
  const { linea: lineaIn, op: opIn, acumuladoStr, usuario, observacion,
          timestamp, forzarSobreproduccion, guardar = true } = opts;

  const linea = (lineaIn || '').trim();
  if (!linea) return { ok:false, icon:'warning', title:'Dato obligatorio', message:'Seleccione una línea.' };
  
  const op = (opIn == null ? '' : String(opIn)).trim();
  if (!op) return { ok:false, icon:'warning', title:'Dato obligatorio', message:'Seleccione o escriba una OP.' };
  
  const cantidadHora = Number(acumuladoStr);

  if (acumuladoStr === '' || acumuladoStr == null || Number.isNaN(cantidadHora)){
    return { ok:false, icon:'warning', title:'Dato incorrecto', message:'Digite las unidades producidas en la hora.' };
  }
  
  if (cantidadHora < 0){
    return { ok:false, icon:'warning', title:'Dato incorrecto', message:'Las unidades producidas en la hora no pueden ser negativas.' };
  }
  
  const ahora = timestamp || new Date();
  const prog = buscarProgramacion(linea, op);

  if (!prog) {
    return { ok:false, icon:'error', title:'OP no válida', message:`La OP ${op} no pertenece a la línea ${linea} o no está disponible.` };
  }
  if (prog.cerrada === true) {
    return { ok:false, icon:'warning', title:'OP cerrada', message:`La OP ${op} fue cerrada y ya no admite registros.` };
  }
  if (prog.iniciada !== true) {
    return { ok:false, icon:'warning', title:'OP no iniciada', message:`La OP ${op} aún no se ha iniciado. Presione "INICIAR OP".` };
  }

  registrarInicioTramoOP(prog, ahora.toISOString());

  // Cálculos de acumulado anterior sumando la hora actual
  const previos = state.historico
    .filter(r => r.linea.toUpperCase() === linea.toUpperCase() && String(r.op).trim() === op)
    .sort((a,b) => a.ts.localeCompare(b.ts));

  const acumuladoAnterior = previos.length ? previos[previos.length - 1].acumulado : 0;
  const acumuladoNum = acumuladoAnterior + cantidadHora;

  // Alerta de sobreproducción
  if (prog.cantidad > 0 && acumuladoNum > prog.cantidad && !forzarSobreproduccion){
    return {
      ok:'confirm', icon:'warning', title:'Confirmar sobreproducción',
      message:`El acumulado supera la cantidad programada de ${fmtInt(prog.cantidad)} unidades.\n¿Desea guardar el registro?`,
      pending:{ linea, op, acumuladoStr, usuario, observacion, timestamp, guardar }
    };
  }

  const nowDec = toDecimalHour(ahora);
  let planAcumulado = 0;

  // CÁLCULO MATEMÁTICO DEL PLAN ESPERADO (Descuenta el almuerzo automáticamente)
  if (prog.uph > 0) {
    let horasTranscurridas = 0;
    let descuentoAlimentacion = 0; // Se inicializa el escudo de almuerzo
    
    // 1. Buscamos TODOS los tiempos reales del cronómetro de esta OP
    const tramosOp = state.historialOps.filter(
      item => item.linea === linea && String(item.op) === op
    );

    if (tramosOp.length > 0) {
      tramosOp.forEach(tramo => {
        if (tramo.inicioReal) {
          const inicio = new Date(tramo.inicioReal);
          const fin = tramo.finReal ? new Date(tramo.finReal) : ahora;
          
          horasTranscurridas += (fin - inicio) / 3600000;
          // REGLA: Si la máquina estuvo encendida durante la hora de almuerzo, calculamos cuántos minutos se le descuentan
          descuentoAlimentacion += calcularDescuentoAlimentacion(linea, inicio, fin);
        }
      });
    } else {
      // Respaldo por si hay una OP antigua y no usaron el botón de INICIAR OP
      horasTranscurridas = nowDec - prog.horaInicio;
      if (String(prog.turno || '').toUpperCase() === 'T3' && horasTranscurridas < 0) {
        horasTranscurridas += 24;
      }
    }

    // APLICAR ESCUDO DE ALIMENTACIÓN AL RELOJ FISICO
    horasTranscurridas -= descuentoAlimentacion;
    if (horasTranscurridas < 0) horasTranscurridas = 0;

    // No exigir más horas de las que dura la OP en su totalidad
    if (Number.isFinite(Number(prog.duracion)) && Number(prog.duracion) > 0) {
      horasTranscurridas = Math.min(horasTranscurridas, Number(prog.duracion));
    }

    // Cálculo final: Tiempo físico trabajado * UPH esperado
    planAcumulado = horasTranscurridas * Number(prog.uph);
    
    if (Number(prog.cantidad) > 0 && planAcumulado > Number(prog.cantidad)){
      planAcumulado = Number(prog.cantidad); // Nunca pedir más del total programado
    }
  }

  const diferencia = acumuladoNum - planAcumulado;
  const cumplimiento = planAcumulado > 0 ? acumuladoNum / planAcumulado : 0;
  let estado = 'PENDIENTE';

  if (planAcumulado > 0){
    estado = cumplimiento >= 1 ? 'ADELANTADO' : (cumplimiento >= 0.95 ? 'EN TIEMPO' : 'ATRASADO');
  }

  // Cálculo del "Semáforo" de la hora (rojo, verde, azul)
  const objetivoHora = Number(prog.uph);
  let estadoHora = 'NO CUMPLE';
  let colorEstadoHora = 'rojo';

  // Tolerancia: si hacen hasta 5 unidades más del UPH, es verde. Si hacen más de 5 extras, es azul (Supera).
  // Puedes cambiar el "5" en estas líneas si quieres darle mayor tolerancia de error a la planta.
  if (cantidadHora >= objetivoHora && cantidadHora <= (objetivoHora + 5)){
    estadoHora = 'CUMPLE';
    colorEstadoHora = 'verde';
  }
  else if (cantidadHora > (objetivoHora + 5)){
    estadoHora = 'SUPERA';
    colorEstadoHora = 'azul';
  }

  const record = {
    id: uid(), ts: ahora.toISOString(), fecha: fechaISO(ahora), fechaOperativa: obtenerFechaOperativa(ahora), hora: horaTexto(ahora),
    linea, op, acumulado: acumuladoNum,
    usuario: (usuario || '').trim() || 'Operador',
    observacion: (observacion || '').trim(),
    cantidadHora, planAcumulado, diferencia, cumplimiento, estado, estadoHora, colorEstadoHora, uphPlan: prog.uph, producto: prog.producto
  };

  state.historico.push(record);
  if (guardar) guardarHistorico();

  return { ok:true, record, cantidadHora, cumplimiento };
}

/* ---------------- 8. AGREGACIONES DEL DASHBOARD ---------------- */
function computeDashboard(){
  const fecha = obtenerFechaOperativa(new Date());
  const regsHoy = state.historico.filter(r => obtenerFechaOperativa(r.ts) === fecha);

  const unidadesProducidas = regsHoy.reduce((s,r)=>s+r.cantidadHora, 0);
  const planDelDia = Number(state.totalUnidadesTeoricas) > 0 
    ? Number(state.totalUnidadesTeoricas) 
    : state.programacion.reduce((total, programa) => {
        const cantidad = Number(programa.cantidad);
        return total + (Number.isFinite(cantidad) ? cantidad : 0);
      }, 0);
      
  const cumplimientoGlobal = planDelDia > 0 ? unidadesProducidas/planDelDia : 0;
  const registros = regsHoy.filter(r=>r.op).length;
  
  const ultimosEstadosPorLinea = {};
  regsHoy.forEach(registro => {
    const linea = registro.linea;
    if (!ultimosEstadosPorLinea[linea] || registro.ts > ultimosEstadosPorLinea[linea].ts){
      ultimosEstadosPorLinea[linea] = registro;
    }
  });

  const lineasNoCumplen = Object.values(ultimosEstadosPorLinea).filter(registro => registro.estadoHora === 'NO CUMPLE').length;
  const lineasActivas = new Set(regsHoy.filter(r=>r.cantidadHora>0).map(r=>r.linea)).size;

  const porLinea = LINEAS.map(linea => {
    const regs = regsHoy.filter(r=>r.linea===linea);
    const unidades = regs.reduce((s,r)=>s+r.cantidadHora, 0);
    
    let plan = 0;
    const opsDelDia = [...new Set(regs.map(r => String(r.op)))];
    opsDelDia.forEach(opName => {
      const regsOp = regs.filter(r => String(r.op) === opName).sort((a,b) => a.ts.localeCompare(b.ts));
      if(regsOp.length > 0) {
        plan += regsOp[regsOp.length - 1].planAcumulado;
      }
    });

    const diferencia = unidades - plan;
    const cumplimiento = plan > 0 ? unidades/plan : 0;
    const prog = state.programacion.find(p=>p.linea===linea);

    let opActiva = '', uphPlan = prog ? prog.uph : 0, uphReal = 0;
    const sinRegistros = !regs.length;
    if (regs.length){
      const ultimo = regs.slice().sort((a,b)=>a.ts.localeCompare(b.ts)).pop();
      opActiva = ultimo.op;
      uphPlan = ultimo.uphPlan;
      uphReal = ultimo.cantidadHora;
    }
    
    let estado = 'SIN REGISTRO';
    if (regs.length){
      const ultimo = regs.slice().sort((a,b)=>a.ts.localeCompare(b.ts)).pop();
      estado = ultimo.estadoHora || 'SIN REGISTRO';
    }

    let inicioReal = null;
    const opBusqueda = opActiva || (prog ? prog.op : '');
    if (opBusqueda) {
      const tramos = state.historialOps.filter(item => item.linea === linea && String(item.op) === String(opBusqueda));
      if (tramos.length > 0) {
        const tramoActivo = tramos.find(t => t.finReal === null) || tramos[tramos.length - 1];
        if (tramoActivo && tramoActivo.inicioReal) {
          inicioReal = tramoActivo.inicioReal;
        }
      }
    }

    return { linea, opActiva, unidades, plan, diferencia, cumplimiento, uphPlan, uphReal, estado,
             sinRegistros, opProgramada: prog ? prog.op : '', inicioReal };
  });

  // Cálculo del gráfico de barras por horas (De 14 a 37 cubre el día operativo completo)
  const horas = [];
  for (let horaOperativa = 14; horaOperativa <= 37; horaOperativa++) {
    const horaReloj = ((horaOperativa % 24) + 24) % 24;
    const registrosHora = regsHoy.filter(registro => horaDeRegistro(registro.hora) === horaReloj);

    const realHora = registrosHora.reduce((total, registro) => total + Number(registro.cantidadHora || 0), 0);
    const planHora = registrosHora.reduce((total, registro) => total + Number(registro.uphPlan || 0), 0);

    horas.push({ hora: horaOperativa, real: realHora, plan: planHora });
  }
  
  return { fecha, unidadesProducidas, planDelDia, cumplimientoGlobal, registros, lineasNoCumplen, lineasActivas, porLinea, horas };
}

/* ---------------- 9. CÁLCULO DE CORTES DE TURNO ---------------- 
   Aquí se establecen los horarios que definen los turnos.
   Si algún día cambian los turnos (Ej. ponerlos a las 5:00, 13:00, 21:00)
   debes modificar los números de estas 3 funciones siguientes.
-------------------------------------------------------------- */
function obtenerTurnoActual(){
  const ahora = new Date();
  const hora = ahora.getHours() + ahora.getMinutes() / 60;

  // Turno 1: 06:00 a 13:59
  if (hora >= 6 && hora < 14) return { turno:'T1', inicio:6, fin:14 };
  // Turno 2: 14:00 a 21:59
  if (hora >= 14 && hora < 22) return { turno:'T2', inicio:14, fin:22 };
  // Turno 3: 22:00 a 05:59
  return { turno:'T3', inicio:22, fin:30 };
}

function calcularTiempoEfectivoTurno(opts){
  const turno = obtenerTurnoActual();
  const ahora = new Date();
  let horaActual = ahora.getHours() + ahora.getMinutes()/60;

  if (turno.turno === 'T3' && horaActual < 6) horaActual += 24;

  let horas = horaActual - turno.inicio;

  // Descuentos manuales desde los checkboxes del modal
  // Si en la planta cambia la duración de la cena, cambia este (50/60) por el nuevo tiempo en minutos.
  if (opts.pausa) horas -= (10 / 60);
  if (opts.cena) horas -= (50 / 60);

  horas = Math.max(0, horas);

  return { turno: turno.turno, horasEfectivas: horas };
}

function calcularCorteTurno(opts){
  const datosTurno = calcularTiempoEfectivoTurno(opts);
  const fechaCorte = new Date().toISOString();
  const fechaOperativa = obtenerFechaOperativa(new Date());
  const resultado = [];

  const lineasUnicas = [...new Set(state.programacion.map(x => x.linea))];

  let totalProgramado = 0;
  let totalReal = 0;

  lineasUnicas.forEach(function(linea){
    const programado = calcularProgramadoLineaCorte(linea, fechaCorte, opts);

    const real = state.historico
      .filter(r => r.linea === linea && r.fechaOperativa === fechaOperativa)
      .reduce((total, r) => total + Number(r.cantidadHora || 0), 0);

    const opActiva = state.programacion.find(
      p => p.linea === linea && p.iniciada === true && p.cerrada !== true
    );

    const uphActual = opActiva ? Number(opActiva.uph || 0) : 0;
    
    // Si no se pide nada, pero el operador hizo algo en descanso, regálale el 100% de cumplimiento
    const cumplimiento = programado > 0 ? real / programado : (real > 0 ? 1 : 0);

    totalProgramado += programado;
    totalReal += real;

    resultado.push({
      linea,
      programado: Math.round(programado),
      uph: uphActual,
      real: Math.round(real),
      cumplimiento
    });
  });

  const cumplimientoGlobal = totalProgramado > 0 ? totalReal / totalProgramado : 0;

  return {
    turno: datosTurno.turno,
    horasEfectivas: datosTurno.horasEfectivas,
    totalProgramado: Math.round(totalProgramado),
    totalReal: Math.round(totalReal),
    cumplimientoGlobal,
    detalle: resultado
  };
}

function horasEntreFechas(inicio, fin){
  const inicioFecha = new Date(inicio);
  const finFecha = new Date(fin);
  return (finFecha - inicioFecha) / 3600000;
}

function calcularProgramadoLineaCorte(linea, fechaCorte, opts){
  const corte = new Date(fechaCorte);
  const horaCorte = corte.getHours() + (corte.getMinutes() / 60);

  let inicioTurno;
  if (horaCorte >= 6 && horaCorte < 14) inicioTurno = 6;
  else if (horaCorte >= 14 && horaCorte < 22) inicioTurno = 14;
  else inicioTurno = 22;

  const inicioTurnoFecha = new Date(corte);
  inicioTurnoFecha.setHours(inicioTurno, 0, 0, 0);
  if (inicioTurno === 22 && horaCorte < 6){
    inicioTurnoFecha.setDate(inicioTurnoFecha.getDate() - 1);
  }

  let totalProgramado = 0;
  let horasTotales = 0;
  let descuentoAlimentacionTotal = 0; // NUEVO: Acumulador inteligente

  const tramosLinea = state.historialOps.filter(x => x.linea === linea);

  tramosLinea.forEach(function(tramo){
    if (!tramo.inicioReal) return;

    const inicioReal = new Date(tramo.inicioReal);
    const finReal = tramo.finReal ? new Date(tramo.finReal) : corte;

    let inicioTramo = new Date(inicioReal);
    let finTramo = new Date(finReal);

    if (finTramo <= inicioTurnoFecha) return;
    if (inicioTramo < inicioTurnoFecha) inicioTramo = new Date(inicioTurnoFecha);

    const horas = (finTramo - inicioTramo) / 3600000;
    if (horas <= 0) return;

    horasTotales += horas;
    totalProgramado += horas * Number(tramo.uph || 0);

    // NUEVO: Calcula automáticamente si el turno cruzó con el horario de comida
    descuentoAlimentacionTotal += calcularDescuentoAlimentacion(linea, inicioTramo, finTramo);
  });

  // ESCUDO ANTI-FANTASMAS
  const horasTurnoTranscurridas = (corte - inicioTurnoFecha) / 3600000;
  if (horasTotales > horasTurnoTranscurridas && horasTurnoTranscurridas > 0) {
     totalProgramado = totalProgramado * (horasTurnoTranscurridas / horasTotales);
     horasTotales = horasTurnoTranscurridas;
  }

  // APLICAR DESCUENTOS (Alimentación automática + Pausa manual)
  if (horasTotales > 0) {
    let horasDescuento = descuentoAlimentacionTotal; // Toma el cálculo automático
    
    // La pausa activa sigue siendo con checkbox porque no tiene hora fija
    if (opts && opts.pausa) horasDescuento += (10 / 60);

    if (horasDescuento > horasTotales) {
      horasDescuento = horasTotales;
    }

    if (horasDescuento > 0) {
       const uphPromedio = totalProgramado / horasTotales;
       totalProgramado -= (horasDescuento * uphPromedio);
    }
  }

  return Math.max(0, totalProgramado);
}