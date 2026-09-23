/* ==================================================================
   logica.js — Estado, almacenamiento y reglas de negocio
   ------------------------------------------------------------------
   Contiene la réplica exacta de las validaciones y cálculos del
   módulo VBA "ModuloProduccion.GrabarProduccion" del libro original,
   más las agregaciones que alimentan el Dashboard (equivalentes a
   las fórmulas de la hoja DASHBOARD). Depende de datos.js (LINEAS,
   SEED_PROGRAMACION) — cárgalo después de datos.js en index.html.
   ================================================================== */

/* ---------------- Estado en memoria + almacenamiento ---------------- */
const state = {
  programacion: [],

  historico: [],

  historialOps: [],

  cortesTurno: [],
  usuario: '',

  totalUnidadesTeoricas: 0
};
const STORAGE_KEY_PROG = 'sp_programacion_v1';
const STORAGE_KEY_HIST = 'sp_historico_v1';
const STORAGE_KEY_USER = 'sp_usuario_v1';
const STORAGE_KEY_TOTAL_TEORICO =
  'sp_total_teorico_v1';
const STORAGE_KEY_CORTES =
  'sp_cortes_turno_v1';
const STORAGE_KEY_HISTORIAL_OPS =
  'sp_historial_ops_v1';

/*
 * Detecta si la aplicación se está ejecutando en un entorno que
 * proporciona window.storage.
 */
const hasArtifactStorage =
  typeof window.storage !== 'undefined' &&
  window.storage !== null;

/*
 * Detecta si localStorage está disponible.
 *
 * Algunos navegadores pueden bloquearlo por configuración de
 * privacidad, modo incógnito o políticas corporativas. Por eso
 * se realiza una prueba real de escritura y eliminación.
 */
function localStorageDisponible(){
  try{
    const clavePrueba = '__sp_prueba_storage__';

    window.localStorage.setItem(clavePrueba, '1');
    window.localStorage.removeItem(clavePrueba);

    return true;
  }catch(error){
    console.warn(
      'localStorage no está disponible:',
      error
    );

    return false;
  }
}

const hasLocalStorage = localStorageDisponible();

/*
 * Recupera información guardada.
 *
 * Prioridad:
 * 1. window.storage
 * 2. localStorage
 * 3. null si no existe información
 */
/* --- INICIO CONEXIÓN FIREBASE --- */
const firebaseConfig = {
  apiKey: "AIzaSyABgoxELml0chya1waw0mFEeLX5oysfa2c",
  authDomain: "mes-produccion-tocancipa.firebaseapp.com",
  databaseURL: "https://mes-produccion-tocancipa-default-rtdb.firebaseio.com",
  projectId: "mes-produccion-tocancipa",
  storageBucket: "mes-produccion-tocancipa.firebasestorage.app",
  messagingSenderId: "748547004390",
  appId: "1:748547004390:web:4c4a27eeba8d0795592827"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();
/* --- FIN CONEXIÓN FIREBASE --- */

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

/*
 * Guarda información de forma persistente.
 *
 * Cuando localStorage está disponible, también se guarda allí,
 * incluso si existe window.storage. Esto deja una copia local
 * para las siguientes aperturas en el mismo navegador.
 */
async function storageSet(key, value){
  let guardado = false;

  if (hasArtifactStorage){
    try{
      await window.storage.set(key, value, false);
      guardado = true;
    }catch(error){
      console.warn(
        `No se pudo guardar ${key} en window.storage:`,
        error
      );
    }
  }

  if (hasLocalStorage){
    try{
      window.localStorage.setItem(key, value);
      guardado = true;
    }catch(error){
      console.error(
        `No se pudo guardar ${key} en localStorage:`,
        error
      );
    }
  }

  if (!guardado){
    console.error(
      `No existe almacenamiento disponible para guardar ${key}.`
    );
  }

  return guardado;
}

function guardarProgramacion(){
  return storageSet(
    STORAGE_KEY_PROG,
    JSON.stringify(state.programacion)
  );
}

function guardarHistorico(){
  return storageSet(
    STORAGE_KEY_HIST,
    JSON.stringify(state.historico)
  );
}

function guardarUsuario(){
  return storageSet(
    STORAGE_KEY_USER,
    state.usuario || ''
  );
}

function guardarTotalTeorico(){
  return storageSet(
    STORAGE_KEY_TOTAL_TEORICO,
    String(
      state.totalUnidadesTeoricas || 0
    )
  );
}

function guardarCortesTurno(){


  return storageSet(

    STORAGE_KEY_CORTES,

    JSON.stringify(
      state.cortesTurno
    )

  );

}

function guardarHistorialOps(){

  return storageSet(

    STORAGE_KEY_HISTORIAL_OPS,

    JSON.stringify(
      state.historialOps
    )

  );

}

function seedProgramacionSiVacio(){
  state.programacion = SEED_PROGRAMACION.map(p => ({...p}));
}

// Genera historial de ejemplo relativo a "ahora", para que el dashboard
// nunca se vea vacío al abrir por primera vez, sin importar la hora del
// día. Determina qué líneas ya "iniciaron" su turno (con la misma regla
// de solo-hora-del-día que usa el motor real, tolerando cruce de
// medianoche solo para decidir la semilla) y les crea 1-2 checkpoints
// con un desempeño variado (algunas líneas van bien, otras no), usando
// la MISMA función de negocio que el botón GRABAR para garantizar
// resultados coherentes con el resto del sistema.

function seedHistoricoSiVacio(){
  const ahora = new Date();
  const nowDec = toDecimalHour(ahora);
  const PERFILES = [1.08, 0.97, 0.72, 1.01, 0.90, 0.65];

  function transcurridoConWrap(horaInicio, duracion){
    let t = nowDec - horaInicio;
    if (t < 0) t += 24;
    return t;
  }

  let candidatos = state.programacion.filter(p=>{
    const t = transcurridoConWrap(p.horaInicio, p.duracion);
    return t > 0.4 && t <= p.duracion;
  });
  if (!candidatos.length){
    candidatos = [state.programacion.find(p=>p.linea==='PROBADORES') || state.programacion[0]];
  }

  candidatos.forEach((prog, idx)=>{
    const factor = PERFILES[idx % PERFILES.length];
    const transcurrido = transcurridoConWrap(prog.horaInicio, prog.duracion);
    const checkpoints = transcurrido > 1.3 ? [transcurrido - 1, transcurrido] : [transcurrido];
    checkpoints.forEach(tHrs=>{
      const planTeorico = Math.min(prog.cantidad, Math.max(0, tHrs * prog.uph));
      const acumulado = Math.max(0, Math.round(planTeorico * factor));
      const ts = new Date(ahora.getTime() - (transcurrido - tHrs) * 3600 * 1000);
      registrarProduccion({
        linea: prog.linea, op: prog.op, acumuladoStr: String(acumulado),
        usuario: 'alexi', observacion:'', timestamp: ts, forzarSobreproduccion:true, guardar:false
      });
    });
  });

  guardarHistorico();
}

async function inicializarEstado(){
const [
  progRaw,
  histRaw,
  userRaw,
  totalTeoricoRaw,
  cortesRaw,
  historialOpsRaw

] = await Promise.all([
  storageGet(STORAGE_KEY_PROG),
  storageGet(STORAGE_KEY_HIST),
  storageGet(STORAGE_KEY_USER),
  storageGet(STORAGE_KEY_TOTAL_TEORICO),
storageGet(STORAGE_KEY_CORTES),
storageGet(STORAGE_KEY_HISTORIAL_OPS)

]);


  // Cargar Programación guardada.
  // Si no existe, comenzar con un array vacío.
  try {
    state.programacion =
      progRaw !== null && progRaw !== undefined
        ? JSON.parse(progRaw)
        : [];
  } catch (error) {
    console.error(
      'No se pudo leer la Programación guardada:',
      error
    );

    state.programacion = [];
  }

  // Cargar Histórico guardado.
  // Si no existe, comenzar con un array vacío.
  try {
    state.historico =
      histRaw !== null && histRaw !== undefined
        ? JSON.parse(histRaw)
        : [];
  } catch (error) {
    console.error(
      'No se pudo leer el Histórico guardado:',
      error
    );

    state.historico = [];
  }

  // Asegurar que Programación sea siempre un array.
  // Un array vacío es válido y no debe llenarse con datos demo.
  if (!Array.isArray(state.programacion)){
    state.programacion = [];
    await guardarProgramacion();
  }
state.programacion.forEach(function(op){

  if (typeof op.cerrada === 'undefined'){
    op.cerrada = false;
  }
if (typeof op.iniciada === 'undefined'){
  op.iniciada = false;
}

  if (typeof op.fechaCierre === 'undefined'){
    op.fechaCierre = null;
  }

  if (typeof op.cerradaPor === 'undefined'){
    op.cerradaPor = null;
  }

});
  // Asegurar que Histórico sea siempre un array.
  // Un array vacío es válido y no debe llenarse con datos demo.
  if (!Array.isArray(state.historico)){
    state.historico = [];
    await guardarHistorico();
  }


  // Recuperar el último usuario utilizado.
  state.usuario = userRaw || '';
state.totalUnidadesTeoricas =
  Number(totalTeoricoRaw || 0);
try{

  state.cortesTurno =
    cortesRaw
      ? JSON.parse(cortesRaw)
      : [];

}
catch{

  state.cortesTurno = [];

}

try{

  state.historialOps =
    historialOpsRaw
      ? JSON.parse(
          historialOpsRaw
        )
      : [];

}
catch{

  state.historialOps = [];

 }
 }

/* ---------------- Utilidades de formato y fecha/hora ---------------- */
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

  if (fecha.getHours() < 14){
    fecha.setDate(
      fecha.getDate() - 1
    );
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
function registrarInicioTramoOP(
  prog,
  fechaInicio
){

  const existe =
    state.historialOps.find(
      function(item){

        return (

          item.linea ===
            prog.linea

          &&

          item.op ===
            prog.op

          &&

          item.finReal ===
            null

        );

      }
    );

  if (existe){
    return;
  }

  state.historialOps.push({

    linea:
      prog.linea,

    op:
      prog.op,

    uph:
      prog.uph,

    inicioReal:
      fechaInicio,

    finReal:
      null

  });

  guardarHistorialOps();

}
/* ---------------- Lógica de negocio (macro GrabarProduccion) ----------------
   Réplica exacta de las validaciones y cálculos del módulo VBA
   "ModuloProduccion.GrabarProduccion" del archivo original:
   - validaciones de línea / OP / acumulado
   - búsqueda de la OP en Programación
   - confirmación de sobreproducción
   - cantidadHora, planAcumulado, diferencia, cumplimiento, estado
------------------------------------------------------------------- */

function registrarProduccion(opts){
  const { linea: lineaIn, op: opIn, acumuladoStr, usuario, observacion,
          timestamp, forzarSobreproduccion, guardar = true } = opts;

  const linea = (lineaIn || '').trim();
  if (!linea){
    return { ok:false, icon:'warning', title:'Dato obligatorio', message:'Seleccione una línea.' };
  }
  const op = (opIn == null ? '' : String(opIn)).trim();
  if (!op){
    return { ok:false, icon:'warning', title:'Dato obligatorio', message:'Seleccione o escriba una OP.' };
  }
const cantidadHora =
  Number(acumuladoStr);

if (
  acumuladoStr === '' ||
  acumuladoStr == null ||
  Number.isNaN(cantidadHora)
){
  return {
  ok:false,
  icon:'warning',
  title:'Dato incorrecto',
  message:'Digite las unidades producidas en la hora.'
};
  }
  if (cantidadHora < 0){
    return { ok:false, icon:'warning', title:'Dato incorrecto', message:'Las unidades producidas en la hora no pueden ser negativas.' };
  }
 const ahora = timestamp || new Date();
 const prog = buscarProgramacion(linea, op);

if (!prog){
  return {
    ok:false,
    icon:'error',
    title:'OP no válida',
    message:`La OP ${op} no pertenece a la línea ${linea} o no está disponible en Programación.`
  };
}

if (prog.cerrada === true){
  return {
    ok:false,
    icon:'warning',
    title:'OP cerrada',
    message:
      `La OP ${op} fue cerrada y ya no admite registros.\n\n` +
      `Solicite reapertura al Analista si necesita continuar.`
  };
}

/* --- INICIO NUEVO CÓDIGO: CANDADO PARA OP NO INICIADA --- */
if (prog.iniciada !== true) {
  return {
    ok:false,
    icon:'warning',
    title:'OP no iniciada',
    message:`La OP ${op} aún no se ha iniciado.\n\nDebe presionar el botón "▶ INICIAR OP" antes de poder registrar producción.`
  };
}
/* --- FIN NUEVO CÓDIGO --- */

registrarInicioTramoOP(
  prog,

  ahora.toISOString()

);

// Último acumulado de esa OP
const previos = state.historico
  .filter(
    r =>
      r.linea.toUpperCase() === linea.toUpperCase() &&
      String(r.op).trim() === op
  )
  .sort(
    (a,b) => a.ts.localeCompare(b.ts)
  );

const acumuladoAnterior =
  previos.length
    ? previos[previos.length - 1].acumulado
    : 0;

const acumuladoNum =
  acumuladoAnterior +
  cantidadHora;

if (
  prog.cantidad > 0 &&
  acumuladoNum > prog.cantidad &&
  !forzarSobreproduccion
){
  return {
    ok:'confirm',
    icon:'warning',
    title:'Confirmar sobreproducción',
    message:`El acumulado supera la cantidad programada de ${fmtInt(prog.cantidad)} unidades.\n¿Desea guardar el registro?`,
    pending:{
      linea,
      op,
      acumuladoStr,
      usuario,
      observacion,
      timestamp,
      guardar
    }
  };
}
   


const nowDec = toDecimalHour(ahora);

let planAcumulado = 0;

if (prog.uph > 0) {
      let horasTranscurridas = 0;
      
      // 1. Buscamos TODOS los tiempos reales en los que esta OP ha estado iniciada
      const tramosOp = state.historialOps.filter(
        item => item.linea === linea && String(item.op) === op
      );

      if (tramosOp.length > 0) {
        tramosOp.forEach(tramo => {
          if (tramo.inicioReal) {
            const inicio = new Date(tramo.inicioReal);
            const fin = tramo.finReal ? new Date(tramo.finReal) : ahora;
            // Sumamos el tiempo real de producción en horas (milisegundos a horas)
            horasTranscurridas += (fin - inicio) / 3600000;
          }
        });
      } else {
        // 2. Respaldo (fallback) por si hay una OP antigua sin registro de inicioReal
        horasTranscurridas = nowDec - prog.horaInicio;
        if (String(prog.turno || '').toUpperCase() === 'T3' && horasTranscurridas < 0) {
          horasTranscurridas += 24;
        }
      }

      if (horasTranscurridas < 0) horasTranscurridas = 0;

      // 3. No exigir más unidades del tope máximo de duración
      if (Number.isFinite(Number(prog.duracion)) && Number(prog.duracion) > 0) {
        horasTranscurridas = Math.min(horasTranscurridas, Number(prog.duracion));
      }

      // 4. Plan exacto calculado con cronómetro real
      planAcumulado = horasTranscurridas * Number(prog.uph);
  /*
   * El plan acumulado nunca debe superar la cantidad
   * total programada de la OP.
   */
  if (
    Number(prog.cantidad) > 0 &&
    planAcumulado > Number(prog.cantidad)
  ){
    planAcumulado = Number(prog.cantidad);
  }
}

  const diferencia = acumuladoNum - planAcumulado;
  const cumplimiento = planAcumulado > 0 ? acumuladoNum / planAcumulado : 0;
  let estado = 'PENDIENTE';

if (planAcumulado > 0){

  estado =
    cumplimiento >= 1
      ? 'ADELANTADO'
      : (
          cumplimiento >= 0.95
            ? 'EN TIEMPO'
            : 'ATRASADO'
        );

}

const objetivoHora =
  Number(prog.uph);

let estadoHora = 'NO CUMPLE';

let colorEstadoHora = 'rojo';

if (
  cantidadHora >= objetivoHora &&
  cantidadHora <= (objetivoHora + 5)
){

  estadoHora = 'CUMPLE';
  colorEstadoHora = 'verde';

}
else if (
  cantidadHora > (objetivoHora + 5)
){

  estadoHora = 'SUPERA';
  colorEstadoHora = 'azul';

}
  const record = {
    id: uid(), ts: ahora.toISOString(), fecha: fechaISO(ahora), fechaOperativa:
  obtenerFechaOperativa(
    ahora
  ), hora: horaTexto(ahora),
    linea, op, acumulado: acumuladoNum,
    usuario: (usuario || '').trim() || 'Operador',
    observacion: (observacion || '').trim(),
    cantidadHora,
    planAcumulado,
    diferencia,
    cumplimiento,
    estado,
    estadoHora,
    colorEstadoHora,
    uphPlan: prog.uph, producto: prog.producto
  };

  state.historico.push(record);
  if (guardar) guardarHistorico();

  return { ok:true, record, cantidadHora, cumplimiento };
}

/* ---------------- Agregaciones del Dashboard (hoja DASHBOARD) ---------------- */




function computeDashboard(){
  const fecha =
  obtenerFechaOperativa(
    new Date()
  );

const regsHoy =
  state.historico.filter(
    function(r){

      return (
        obtenerFechaOperativa(
          r.ts
        ) === fecha
      );

    }
  );

  const unidadesProducidas = regsHoy.reduce((s,r)=>s+r.cantidadHora, 0);
 const planDelDia =
  Number(state.totalUnidadesTeoricas) > 0
    ? Number(state.totalUnidadesTeoricas)
    : state.programacion.reduce(
        (total, programa) => {
          const cantidad =
            Number(programa.cantidad);

          return total +
            (
              Number.isFinite(cantidad)
                ? cantidad
                : 0
            );
        },
        0
      );
  const cumplimientoGlobal = planDelDia > 0 ? unidadesProducidas/planDelDia : 0;
  const registros = regsHoy.filter(r=>r.op).length;
 const ultimosEstadosPorLinea =
  {};

regsHoy.forEach(function(registro){

  const linea =
    registro.linea;

  if (
    !ultimosEstadosPorLinea[linea] ||
    registro.ts >
    ultimosEstadosPorLinea[linea].ts
  ){

    ultimosEstadosPorLinea[linea] =
      registro;

  }

});

const lineasNoCumplen =
  Object.values(
    ultimosEstadosPorLinea
  )
  .filter(
    registro =>
      registro.estadoHora ===
      'NO CUMPLE'
  )
  .length;
  const lineasActivas = new Set(regsHoy.filter(r=>r.cantidadHora>0).map(r=>r.linea)).size;

  const porLinea = LINEAS.map(linea=>{
    const regs = regsHoy.filter(r=>r.linea===linea);
    const unidades = regs.reduce((s,r)=>s+r.cantidadHora, 0);
    
    // CORRECCIÓN: No sumar los acumulados a ciegas. 
    // Tomamos el último plan esperado válido de cada OP activa hoy en la línea.
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
      
      /* --- INICIO CÓDIGO CORREGIDO: UPH REAL = ÚLTIMO REGISTRO --- */
      uphReal = ultimo.cantidadHora;
      /* --- FIN CÓDIGO CORREGIDO --- */
    }
   let estado = 'SIN REGISTRO';

if (regs.length){
  const ultimo = regs.slice().sort((a,b)=>a.ts.localeCompare(b.ts)).pop();
  estado = ultimo.estadoHora || 'SIN REGISTRO';
}

  // CORRECCIÓN: BUSCAR LA HORA DE INICIO REAL CORRECTA (ÚLTIMO TRAMO)
  let inicioReal = null;
  const opBusqueda = opActiva || (prog ? prog.op : '');
  if (opBusqueda) {
    const tramos = state.historialOps.filter(item => item.linea === linea && String(item.op) === String(opBusqueda));
    if (tramos.length > 0) {
      // Tomar el tramo que sigue abierto, o en su defecto el último registrado
      const tramoActivo = tramos.find(t => t.finReal === null) || tramos[tramos.length - 1];
      if (tramoActivo && tramoActivo.inicioReal) {
        inicioReal = tramoActivo.inicioReal;
      }
    }
  }

  return { linea, opActiva, unidades, plan, diferencia, cumplimiento, uphPlan, uphReal, estado,
           sinRegistros, opProgramada: prog ? prog.op : '', inicioReal };
});

/*
 * Producción por hora del día operativo.
 *
 * El día operativo empieza a las 23:00 del día anterior
 * y termina a las 23:00 del día actual.
 *
 * Coordenadas utilizadas:
 * 23 = 23:00 del día anterior
 * 24 = 00:00 del día del programa
 * 25 = 01:00
 * ...
 * 46 = 22:00
 */
const horas = [];

for (let horaOperativa = 14; horaOperativa <= 37; horaOperativa++) {

  const horaReloj =
    ((horaOperativa % 24) + 24) % 24;

  const registrosHora =
    regsHoy.filter(function(registro){

      return (
        horaDeRegistro(
          registro.hora
        ) === horaReloj
      );

    });

  const realHora =
    registrosHora.reduce(
      function(total, registro){

        return (
          total +
          Number(
            registro.cantidadHora || 0
          )
        );

      },
      0
    );

  const planHora =
    registrosHora.reduce(
      function(total, registro){

        return (
          total +
          Number(
            registro.uphPlan || 0
          )
        );

      },
      0
    );

  horas.push({

    hora: horaOperativa,

    real: realHora,

    plan: planHora

  });

}
return {
  fecha,
  unidadesProducidas,
  planDelDia,
  cumplimientoGlobal,
  registros,
  lineasNoCumplen,
  lineasActivas,
  porLinea,
  horas
};
}

function obtenerTurnoActual(){

  const ahora =
    new Date();

  const hora =
    ahora.getHours() +
    ahora.getMinutes() / 60;

  if (
    hora >= 6 &&
    hora < 14
  ){
    return {
      turno:'T1',
      inicio:6,
      fin:14
    };
  }

  if (
    hora >= 14 &&
    hora < 22
  ){
    return {
      turno:'T2',
      inicio:14,
      fin:22
    };
  }

  return {
    turno:'T3',
    inicio:22,
    fin:30
  };

}
function calcularTiempoEfectivoTurno(opts){

  const turno =
    obtenerTurnoActual();

  const ahora =
    new Date();

  let horaActual =
    ahora.getHours() +
    ahora.getMinutes()/60;

  if (
    turno.turno === 'T3' &&
    horaActual < 6
  ){
    horaActual += 24;
  }

  let horas =
    horaActual -
    turno.inicio;

  if (opts.pausa){
    horas -=
      (10 / 60);
  }

  if (opts.cena){
    horas -=
      (50 / 60);
  }

  horas =
    Math.max(
      0,
      horas
    );

  return {
    turno: turno.turno,
    horasEfectivas: horas
  };

}

function calcularCorteTurno(opts){

  const datosTurno =
    calcularTiempoEfectivoTurno(
      opts
    );

  const fechaCorte =
    new Date().toISOString();

  const fechaOperativa =
    obtenerFechaOperativa(
      new Date()
    );

  const resultado = [];

  const lineasUnicas =
    [
      ...new Set(
        state.programacion.map(
          x => x.linea
        )
      )
    ];

  let totalProgramado = 0;
  let totalReal = 0;

  lineasUnicas.forEach(function(linea){

    const programado =
      calcularProgramadoLineaCorte(
        linea,
        fechaCorte
      );

    const real =
      state.historico
        .filter(function(r){

          if (
            r.linea !== linea
          ){
            return false;
          }

          if (
            r.fechaOperativa !==
            fechaOperativa
          ){
            return false;
          }

          return true;

        })
        .reduce(
          function(total, r){
            return (
              total +
              Number(
                r.cantidadHora || 0
              )
            );
          },
          0
        );

    const opActiva =
      state.programacion.find(
        p =>
          p.linea === linea &&
          p.cerrada !== true
      );

    const uphActual =
      opActiva
        ? Number(
            opActiva.uph || 0
          )
        : 0;

    const cumplimiento =
      programado > 0
        ? real / programado
        : 0;

    totalProgramado +=
      programado;

    totalReal +=
      real;

    resultado.push({

      linea,

      programado:
        Math.round(
          programado
        ),

      uph:
        uphActual,

      real:
        Math.round(
          real
        ),

      cumplimiento

    });

  });

  const cumplimientoGlobal =
    totalProgramado > 0
      ? totalReal /
        totalProgramado
      : 0;

  return {

    turno:
      datosTurno.turno,

    horasEfectivas:
      datosTurno.horasEfectivas,

    totalProgramado:
      Math.round(
        totalProgramado
      ),

    totalReal:
      Math.round(
        totalReal
      ),

    cumplimientoGlobal,

    detalle:
      resultado

  };

}
function horasEntreFechas(
  inicio,
  fin
){

  const inicioFecha =
    new Date(inicio);

  const finFecha =
    new Date(fin);

  return (
    finFecha -
    inicioFecha
  ) / 3600000;

}
function calcularEsperadoLineaDesdeTramos(
  linea,
  fechaCorte
){

  const tramos =
    state.historialOps.filter(
      function(item){
        return item.linea === linea;
      }
    );

  let esperado = 0;

  tramos.forEach(function(tramo){

    if (!tramo.inicioReal){
      return;
    }

    const inicio =
      tramo.inicioReal;

    const fin =
      tramo.finReal ||
      fechaCorte;

    const horas =
      horasEntreFechas(
        inicio,
        fin
      );

    esperado +=
      horas *
      Number(
        tramo.uph || 0
      );

  });

  return esperado;

}
function calcularProgramadoLineaCorte(
  linea,
  fechaCorte
){

  const corte =
    new Date(fechaCorte);

  const horaCorte =
    corte.getHours() +
    (corte.getMinutes() / 60);

  let inicioTurno;

  if (
    horaCorte >= 6 &&
    horaCorte < 14
  ){
    inicioTurno = 6;
  }
  else if (
    horaCorte >= 14 &&
    horaCorte < 22
  ){
    inicioTurno = 14;
  }
  else{
    inicioTurno = 22;
  }

  let totalProgramado = 0;

  const tramosLinea =
    state.historialOps.filter(
      x => x.linea === linea
    );

  tramosLinea.forEach(function(tramo){

    if (!tramo.inicioReal){
      return;
    }

    const inicioReal =
      new Date(
        tramo.inicioReal
      );

    const finReal =
      tramo.finReal
        ? new Date(
            tramo.finReal
          )
        : corte;

    let inicioTramo =
      new Date(
        inicioReal
      );

    let finTramo =
      new Date(
        finReal
      );

    const inicioTurnoFecha =
      new Date(corte);

    inicioTurnoFecha.setHours(
      inicioTurno,
      0,
      0,
      0
    );

    if (
      inicioTurno === 22 &&
      horaCorte < 6
    ){
      inicioTurnoFecha.setDate(
        inicioTurnoFecha.getDate() - 1
      );
    }

    if (
      finTramo <= inicioTurnoFecha
    ){
      return;
    }

    if (
      inicioTramo < inicioTurnoFecha
    ){
      inicioTramo =
        inicioTurnoFecha;
    }

    const horas =
      (finTramo - inicioTramo) /
      3600000;

    if (horas <= 0){
      return;
    }

    totalProgramado +=
      horas *
      Number(
        tramo.uph || 0
      );

  });

  return totalProgramado;

}