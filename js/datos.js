/* ==================================================================
   datos.js — Datos maestros y configuración de respaldo ejecutando 
   doble clik en el index html.
   ------------------------------------------------------------------
   Intenta leer /json/*.json (así, si el proyecto se sirve desde un
   servidor web, basta con editar esos archivos para cambiar líneas,
   la programación inicial o la clave de analista, sin tocar código).

   Si el navegador bloquea esa lectura —lo cual ocurre siempre que se
   abre index.html con doble clic, por seguridad de los navegadores
   ante el protocolo file://— se usan los valores de respaldo de más
   abajo, para que la aplicación funcione igual sin servidor.
   ================================================================== */

// ---- Valores de respaldo (se usan si no se pueden leer los JSON) ----
const LINEAS_RESPALDO = [
  'VERSAFILL',
  'JVH1',
  'JVH2',
  'PKB 1',
  'PKB 2',
  'PKB 3',
  'PKB 4',
  'PKB 5',
  'PKB 6',
  'MRM',
  'OMAS',
  'PROBADORES',
  'ESMALTES',
  "MANUAL 1",
  "MANUAL 2",
  "MANUAL 3"
];

const SEED_PROGRAMACION_RESPALDO = [
  { linea:'VERSAFILL',  op:'12750692', codigo:'20-0121381', producto:'ES COLORS FLO CITY COL 200ML',   uph:1300, horaInicio:6,  duracion:2.449230769,  cantidad:4982   },
  { linea:'JVH1',       op:'12750312', codigo:'20-0039855', producto:'CZ NITRO EDT 100 ML',             uph:1800, horaInicio:6,  duracion:21.5,          cantidad:113048 },
  { linea:'JVH2',       op:'12750580', codigo:'20-0082674', producto:'ES MINI CHI COL KELL CC 120 ML',  uph:1449, horaInicio:7,  duracion:12.415113872,  cantidad:39000  },
  { linea:'PKB 1',      op:'12750313', codigo:'20-0122977', producto:'CZ IN LOVE POTION EDP 50 ML',     uph:1500, horaInicio:8,  duracion:7.989393939,   cantidad:15793  },
  { linea:'PKB 2',      op:'12750309', codigo:'20-0113646', producto:'LB MISS LBEL PARF 50ML',          uph:1500, horaInicio:9,  duracion:21.5,          cantidad:44579  },
  { linea:'PKB 3',      op:'12750714', codigo:'20-0118219', producto:'ES FANTASIA AZUL EDP UPG 50ML',   uph:1600, horaInicio:10, duracion:3.429979839,   cantidad:7825   },
  { linea:'PKB 4',      op:'12750496', codigo:'20-0105041', producto:'ES SALVAJE COLOGNE CC 90 ML',     uph:1600, horaInicio:14, duracion:5.72,           cantidad:31000  },
  { linea:'PKB 5',      op:'12750724', codigo:'20-0120744', producto:'LB BLEU INFIN PARF 100 ML',       uph:1500, horaInicio:14, duracion:3.703333333,   cantidad:12250  },
  { linea:'PKB 6',      op:'12750004', codigo:'20-0100539', producto:'ES WINNER SPORT EDP CC 100ML',    uph:2700, horaInicio:15, duracion:12.972478632,  cantidad:54123  },
  { linea:'MRM',        op:'12750075', codigo:'20-0121770', producto:'CZ CREAM CARAM 37 PERFM 150 ML',  uph:1300, horaInicio:17, duracion:10.67,          cantidad:15186  },
  { linea:'OMAS',       op:'12750605', codigo:'20-0108157', producto:'LB BLEU INTENSE PARF MINI 10ML',  uph:1400, horaInicio:19, duracion:6.455714286,   cantidad:10073  },
  { linea:'PROBADORES', op:'12750888', codigo:'20-0098726', producto:'ES KALOS SPORT CC PLUMA 0.9ML',   uph:6000, horaInicio:22, duracion:5.785666667,   cantidad:32694  },
];

const ANALISTA_PIN_RESPALDO = 'Analista2026';
const AUTORIZACION_CAUSALES_PIN_RESPALDO = 'Analista2026';

const CAUSALES_PARO_RESPALDO = [
  {
    id: 'ALIMENTACION',
    nombre: 'Tiempo de alimentación',
    activa: true
  },
  {
    id: 'PAUSA_ACTIVA',
    nombre: 'Pausa activa',
    activa: true
  },
  {
    id: 'LECTURA_PROCEDIMIENTOS',
    nombre: 'Lectura de procedimientos',
    activa: true
  },
  {
    id: 'CAMBIO_TURNO',
    nombre: 'Cambio de turno',
    activa: true
  }
];

// ---- Valores activos (pueden reemplazarse por el contenido de /json) ----
let LINEAS = LINEAS_RESPALDO.slice();
let SEED_PROGRAMACION = SEED_PROGRAMACION_RESPALDO.map(p=>({...p}));
let ANALISTA_PIN = ANALISTA_PIN_RESPALDO;
let AUTORIZACION_CAUSALES_PIN =
  AUTORIZACION_CAUSALES_PIN_RESPALDO;

let CAUSALES_PARO =
  CAUSALES_PARO_RESPALDO.map(function(causal){
    return { ...causal };
  });

function turnoDe(horaInicio){
  if (horaInicio >= 6 && horaInicio < 14) return 'T1';
  if (horaInicio >= 14 && horaInicio < 22) return 'T2';
  return 'T3';
}

async function cargarJSON(ruta){
  try{
    const resp = await fetch(ruta);
    if (!resp.ok) return null;
    return await resp.json();
  }catch(e){
    return null; // bloqueado por el navegador (file://) o el archivo no existe: se usa el respaldo
  }
}

// Lee /json/config.json, /json/parametros.json y /json/programacion-inicial.json.
// Cualquiera que falle conserva su valor de respaldo — nunca deja la app sin datos.
async function cargarConfiguracion(){
  const [config, parametros, progInicial] = await Promise.all([
    cargarJSON('../json/config.json'),
    cargarJSON('../json/parametros.json'),
    cargarJSON('../json/programacion-inicial.json'),
  ]);

  if (config && typeof config.claveAnalista === 'string' && config.claveAnalista.trim() !== ''){
    ANALISTA_PIN = config.claveAnalista.trim();
  }

  if (
  config &&
  typeof config.claveAutorizacionCausales === 'string' &&
  config.claveAutorizacionCausales.trim() !== ''
){
  AUTORIZACION_CAUSALES_PIN =
    config.claveAutorizacionCausales.trim();
}
  const tituloEl = document.querySelector('.brand-text b');
  const subtituloEl = document.querySelector('.brand-text span');
  if (config && config.tituloApp && tituloEl) tituloEl.textContent = config.tituloApp;
  if (config && config.subtituloApp && subtituloEl) subtituloEl.textContent = config.subtituloApp;
  if (config && config.tituloApp) document.title = config.tituloApp + ' · Dashboard';

  if (parametros && Array.isArray(parametros.lineas) && parametros.lineas.length){
    LINEAS = parametros.lineas;
  }
if (
  parametros &&
  Array.isArray(parametros.causalesParo) &&
  parametros.causalesParo.length
){
  CAUSALES_PARO = parametros.causalesParo
    .filter(function(causal){
      return (
        causal &&
        typeof causal.nombre === 'string' &&
        causal.nombre.trim() !== ''
      );
    })
    .map(function(causal, indice){
      return {
        id:
          String(
            causal.id ||
            'CAUSAL_' + (indice + 1)
          )
            .trim()
            .toUpperCase(),

        nombre:
          causal.nombre.trim(),

        requiereRevision:
          causal.requiereRevision === true,

        activa:
          causal.activa !== false
      };
    });
}

  if (progInicial && Array.isArray(progInicial.programacion) && progInicial.programacion.length){
    SEED_PROGRAMACION = progInicial.programacion;
  }
}
