/* ==================================================================
   app.js — Orquestación: navegación, reloj, Cargar Programa (analista),
   exportar Histórico a Excel, e inicio de la aplicación.
   ------------------------------------------------------------------
   Este es el único archivo que engancha eventos de botones/forms y
   arranca todo (init() al final). Depende de datos.js, logica.js y
   vistas.js — cárgalo de último en index.html.
   ================================================================== */

document.getElementById('mainNav').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-view]');
  if (!btn) return;
  document.querySelectorAll('#mainNav button').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-'+btn.dataset.view).classList.add('active');
  if (btn.dataset.view === 'dashboard') renderChartHoras(computeDashboard().horas);
});

document
  .getElementById('fLinea')
  .addEventListener('change', function(){
    actualizarOpOptions();
    actualizarReadout();
  });

document
  .getElementById('fOP')
  .addEventListener('input', function(){
    actualizarReadout();
  });
document.getElementById('formControl').addEventListener('submit', manejarSubmitControl);
document.getElementById('btnCerrarOpActual').addEventListener('click', cerrarOpActual);

document
  .getElementById('btnIniciarOp')
  .addEventListener(
    'click',
    async function(){

      const linea =
        document.getElementById('fLinea').value;

      const op =
        document.getElementById('fOP').value.trim();

      if (!linea || !op){
        await modalAlerta(
          'Seleccione una OP',
          'Debe seleccionar una línea y una OP antes de iniciar.'
        );
        return;
      }

      const prog = buscarProgramacion(linea, op);

      if (!prog){
        await modalError(
          'OP no encontrada',
          'No se encontró la OP seleccionada.'
        );
        return;
      }

      if (prog.cerrada === true){
        await modalError(
          'OP cerrada',
          'La OP está cerrada.'
        );
        return;
      }

      if (prog.iniciada === true){
        await modalAlerta(
          'OP ya iniciada',
          'La OP ya se encuentra en producción.'
        );
        return;
      }

      /* --- INICIO NUEVO CÓDIGO: ENCLAVAMIENTO DE LÍNEA --- */
      // Buscamos si existe OTRA OP en esta misma línea que ya esté iniciada pero NO cerrada
      const opActivaEnLinea = state.programacion.find(
        p => 
          p.linea.trim().toUpperCase() === linea.trim().toUpperCase() && 
          p.iniciada === true && 
          p.cerrada !== true &&
          p.op !== prog.op
      );

      if (opActivaEnLinea) {
        await modalError(
          'Línea ocupada',
          `No puedes iniciar esta orden. La OP ${opActivaEnLinea.op} está actualmente activa en esta línea.\n\nDebes presionar "🔒 CERRAR OP ACTUAL" antes de iniciar una nueva.`
        );
        return;
      }
      /* --- FIN NUEVO CÓDIGO --- */

      prog.iniciada = true;

      state.historialOps.push({
        linea: prog.linea,
        op: prog.op,
        uph: prog.uph,
        inicioReal: new Date().toISOString(),
        finReal: null
      });

      await guardarProgramacion();
      await guardarHistorialOps();

      actualizarReadout();
      renderTodo();

      await modalExito(
        'OP iniciada',
        `La OP ${prog.op} inició correctamente.`
      );
    }
  );

document.getElementById('formProgramacion').addEventListener('submit', manejarSubmitProgramacion);
document.getElementById('buscarHistorico').addEventListener('input', renderHistorico);
document.getElementById('btnExportarHistorico').addEventListener('click', exportarHistoricoXLSX);
document.getElementById('btnResetDemo').addEventListener('click', confirmarResetDemo);

document
  .getElementById('btnCorteTurno')
  .addEventListener('click', function(){
      document.getElementById('corteOverlay').classList.add('show');
  });

document
  .getElementById('btnCerrarCorte')
  .addEventListener('click', function(){
      document.getElementById('corteOverlay').classList.remove('show');
  });

/* --- INICIO NUEVO EVENTO: BOTÓN CALCULAR CORTE --- */
document.getElementById('btnCalcularCorte').addEventListener('click', async function(){
  
  // 1. Leer los checkboxes de la interfaz
  const aplicaPausa = document.getElementById('chkPausaActiva').checked;
  const aplicaCena = document.getElementById('chkCena').checked;

  // 2. Ejecutar la función matemática de logica.js
  const resultadoCorte = calcularCorteTurno({ pausa: aplicaPausa, cena: aplicaCena });

  // 3. Generar el ID consecutivo correcto (Ej: CORTE-0005)
  let ultimoNumero = 0;
  if (state.cortesTurno.length > 0) {
      const ultimoCorte = state.cortesTurno[state.cortesTurno.length - 1];
      const partesId = ultimoCorte.id.split('-');
      if (partesId.length === 2) {
          ultimoNumero = parseInt(partesId[1], 10) || 0;
      }
  }
  const idFormateado = 'CORTE-' + String(ultimoNumero + 1).padStart(4, '0');

  // 4. Obtener la fecha en formato compatible (YYYY-MM-DD) para no romper la tabla
  const fechaCorrecta = fechaISO(new Date());

  // 5. Ensamblar el corte final
  const nuevoCorte = {
    id: idFormateado,
    fecha: fechaCorrecta,
    hora: horaTexto(new Date()),
    ...resultadoCorte
  };

  // 6. Guardar en memoria y en almacenamiento local
  state.cortesTurno.push(nuevoCorte);
  await guardarCortesTurno();

  // 7. Cerrar la ventana de los checkboxes
  document.getElementById('corteOverlay').classList.remove('show');

  // 8. Refrescar la tabla para que aparezca el nuevo corte
  renderHistorialCortes();

  // 9. Mostrar el reporte detallado (el modal con el desglose por línea)
  mostrarDetalleCorte(nuevoCorte);

  // 10. Limpiar los checkboxes para el próximo corte
  document.getElementById('chkPausaActiva').checked = false;
  document.getElementById('chkCena').checked = false;
});
/* --- FIN NUEVO EVENTO: BOTÓN CALCULAR CORTE --- */

/* --- INICIO DEL CÓDIGO CORREGIDO PARA CERRAR MODALES --- */
document.getElementById('modalOverlay').addEventListener('click', (e)=>{
  if (e.target.id === 'modalOverlay'){ 
    cerrarModal(); 
    if (_modalResolve) _modalResolve(false); 
  }
});

document.getElementById('corteOverlay').addEventListener('click', function(e){
  if (e.target.id === 'corteOverlay'){
    document.getElementById('corteOverlay').classList.remove('show');
  }
});
/* --- FIN DEL CÓDIGO CORREGIDO PARA CERRAR MODALES --- */

window.addEventListener('resize', ()=>{
  clearTimeout(window._spResizeT);
  window._spResizeT = setTimeout(()=>{ if(document.getElementById('view-dashboard').classList.contains('active')) renderChartHoras(computeDashboard().horas); }, 150);
});

/* ---------------- Carga de Programación desde MASTER (solo analista) ---------------- */
let _importParsed = null;

function parseNumero(raw){
  if (raw === null || raw === undefined) return NaN;
  let texto = String(raw).trim().replace(/\s/g, '');
  if (texto === '') return NaN;

  if (texto.includes(',') && texto.includes('.')){
    const ultimaComa = texto.lastIndexOf(',');
    const ultimoPunto = texto.lastIndexOf('.');
    if (ultimaComa > ultimoPunto){
      texto = texto.replace(/\./g, '').replace(',', '.');
    } else {
      texto = texto.replace(/,/g, '');
    }
  } else if (texto.includes(',')){
    const partes = texto.split(',');
    const parteFinal = partes[partes.length - 1];
    if (partes.length > 2 || parteFinal.length === 3){
      texto = texto.replace(/,/g, '');
    } else {
      texto = texto.replace(',', '.');
    }
  } else if ((texto.match(/\./g) || []).length > 1){
    texto = texto.replace(/\./g, '');
  }

  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : NaN;
}

function parseHoraCampo(raw){
  if (raw == null) return NaN;
  const s = String(raw).trim();
  if (s === '') return NaN;
  if (s.includes(':')){
    const partes = s.split(':').map(Number);
    return (partes[0]||0) + (partes[1]||0)/60 + (partes[2]||0)/3600;
  }
  const n = parseNumero(s);
  if (Number.isNaN(n)) return NaN;
  return (n > 0 && n < 1) ? n*24 : n; 
}

function normalizarLinea(raw){
  const s = (raw||'').trim().toUpperCase().replace(/\s+/g,' ');
  const compacta = s.replace(/\s+/g,'');
  const encontrada = LINEAS.find(l => l.replace(/\s+/g,'') === compacta);
  return encontrada || s;
}

function parseMasterPegado(texto){
  const filasTexto = texto.split(/\r\n|\r|\n/).filter(l=>l.trim() !== '');
  const filas = filasTexto.slice(1); 
  const resultado = [];
  const lineasDesconocidas = new Set();
  let totalUnidadesTeoricas = 0;

  filasTexto.forEach(function(lineaTexto){
    const columnas = lineaTexto.split('\t');
    const indiceEtiqueta = columnas.findIndex(function(columna){
      const texto = String(columna).toUpperCase().replace(/\s+/g, ' ').trim();
      return texto.includes('TOTAL UNIDADES TEORICAS');
    });

    if (indiceEtiqueta === -1) return;

    for (let i = indiceEtiqueta + 1; i < columnas.length; i++){
      const valor = parseNumero(columnas[i]);
      if (Number.isFinite(valor) && valor > 0){
        totalUnidadesTeoricas = valor;
        console.log('TOTAL TEORICO ENCONTRADO:', valor);
        break;
      }
    }
  });

  filas.forEach(linea=>{
    const cols = linea.split('\t');
    const turno = (cols[3]||'').trim();
    const lineaRaw = (cols[4]||'').trim();
    const op = (cols[8]||'').trim();
    if (!turno || !lineaRaw || !op) return;
    const uph = parseNumero(cols[14]);
    if (!Number.isFinite(uph) || uph <= 0) return;

    const linea_norm = normalizarLinea(lineaRaw);
    if (!LINEAS.includes(linea_norm)) lineasDesconocidas.add(lineaRaw);

    const hEjec = parseNumero(cols[18]);
    const hInicio = parseHoraCampo(cols[19]);
    const hFin = parseHoraCampo(cols[20]);
    let duracion = (Number.isFinite(hEjec) && hEjec > 0) ? hEjec : null;
    if (duracion == null && Number.isFinite(hInicio) && Number.isFinite(hFin)){
      duracion = hFin - hInicio;
      if (duracion < 0) duracion += 24;
    }
    if (duracion == null || !Number.isFinite(duracion) || duracion <= 0) duracion = 8;

    const saldo = parseNumero(cols[12]);

    resultado.push({
      turno: turno.toUpperCase(),
      linea: linea_norm,
      op,
      codigo: (cols[9] || '').trim(),
      producto: (cols[10] || '').trim(),
      uph,
      horaInicio: Number.isFinite(hInicio) ? hInicio : 0,
      duracion,
      cantidad: Number.isFinite(saldo) ? saldo : 0,
    });
  });

  return {
    filas: resultado,
    totalPegado: filas.length,
    lineasDesconocidas: Array.from(lineasDesconocidas),
    totalUnidadesTeoricas
  };
}

function abrirImportModal(){
  document.getElementById('importStepPin').style.display = '';
  document.getElementById('importStepPaste').style.display = 'none';
  document.getElementById('importStepConfirm').style.display = 'none';
  document.getElementById('importPinInput').value = '';
  document.getElementById('importPinError').textContent = '';
  document.getElementById('importOverlay').classList.add('show');
  setTimeout(()=>document.getElementById('importPinInput').focus(), 50);
}
function cerrarImportModal(){
  document.getElementById('importOverlay').classList.remove('show');
}

document.getElementById('btnCargarPrograma').addEventListener('click', abrirImportModal);
document.getElementById('importPinCancel').addEventListener('click', cerrarImportModal);
document.getElementById('importPasteCancel').addEventListener('click', cerrarImportModal);
document.getElementById('importOverlay').addEventListener('click', (e)=>{ if (e.target.id === 'importOverlay') cerrarImportModal(); });

document.getElementById('importPinSubmit').addEventListener('click', ()=>{
  const val = document.getElementById('importPinInput').value;
  if (val !== ANALISTA_PIN){
    document.getElementById('importPinError').textContent = 'Clave incorrecta.';
    return;
  }
  document.getElementById('importStepPin').style.display = 'none';
  document.getElementById('importStepPaste').style.display = '';
  document.getElementById('importTextarea').value = '';
  document.getElementById('importPreview').textContent = '';
  setTimeout(()=>document.getElementById('importTextarea').focus(), 50);
});
document.getElementById('importPinInput').addEventListener('keydown', (e)=>{
  if (e.key === 'Enter'){ e.preventDefault(); document.getElementById('importPinSubmit').click(); }
});

document
  .getElementById('importPasteAnalizar')
  .addEventListener('click', function(){
    const textarea = document.getElementById('importTextarea');
    const preview = document.getElementById('importPreview');

    if (!textarea || !preview) return;

    const texto = textarea.value;

    if (!texto || !texto.trim()){
      preview.innerHTML = '<span style="color:var(--st-atrasado); font-weight:600;">Pega los datos antes de analizar.</span>';
      return;
    }

    try{
      const resultado = parseMasterPegado(texto);
      state.totalUnidadesTeoricas = Number(resultado.totalUnidadesTeoricas || 0);
      guardarTotalTeorico();

      const filas = Array.isArray(resultado.filas) ? resultado.filas : [];
      const totalPegado = Number(resultado.totalPegado || 0);
      const lineasDesconocidas = Array.isArray(resultado.lineasDesconocidas) ? resultado.lineasDesconocidas : [];

      _importParsed = filas;

      if (!filas.length){
        preview.innerHTML = '<span style="color:var(--st-atrasado); font-weight:600;">No se encontraron filas válidas. Revisa Turno, Línea, OP, UPH y la ubicación de las columnas del MASTER.</span>';
        return;
      }

      const lineasSet = new Set(filas.map(function(fila){ return fila.linea; }));
      let mensaje = '<b style="color:var(--purple-700); font-family:var(--font-display);">' + filas.length + '</b> OP válidas de <b>' + totalPegado + '</b> filas pegadas, en <b>' + lineasSet.size + '</b> línea(s).';

      if (lineasDesconocidas.length){
        mensaje += '<br><span style="color:var(--st-enriesgo); font-weight:600;">Línea(s) no reconocida(s): ' + lineasDesconocidas.join(', ') + '.</span>';
      }

      preview.innerHTML = mensaje;

      const pasoPegar = document.getElementById('importStepPaste');
      const pasoConfirmar = document.getElementById('importStepConfirm');
      const mensajeConfirmacion = document.getElementById('importConfirmMsg');

      const cantidadActual = window.state && Array.isArray(window.state.programacion) ? window.state.programacion.length : (typeof state !== 'undefined' && Array.isArray(state.programacion) ? state.programacion.length : 0);

      mensajeConfirmacion.textContent = 'Esto reemplazará las ' + cantidadActual + ' OP actuales de Programación por las ' + filas.length + ' OP recién analizadas. Los registros del Histórico no se modificarán. ¿Confirmas la carga?';

      pasoPegar.style.display = 'none';
      pasoConfirmar.style.display = 'block';

    }catch(error){
      preview.innerHTML = '<span style="color:var(--st-atrasado); font-weight:600;">Error al preparar la carga: ' + String(error.message || error) + '</span>';
    }
  });

document.getElementById('importConfirmBack').addEventListener('click', ()=>{
  document.getElementById('importStepConfirm').style.display = 'none';
  document.getElementById('importStepPaste').style.display = '';
});

document
  .getElementById('importConfirmOk')
  .addEventListener('click', async function(){
    const boton = document.getElementById('importConfirmOk');

    try{
      if (!_importParsed || !Array.isArray(_importParsed) || !_importParsed.length){
        await modalError('Sin información', 'No hay una programación analizada para guardar.');
        return;
      }

      if (boton){
        boton.disabled = true;
        boton.textContent = 'Guardando...';
      }

      /* --- INICIO NUEVO CÓDIGO: LIMPIEZA AUTOMÁTICA DE FANTASMAS --- */
      // Cuando el analista carga un nuevo programa, cerramos todos los cronómetros huérfanos del día anterior
      state.historialOps.forEach(t => {
        if (t.finReal === null) {
          t.finReal = new Date().toISOString();
        }
      });
      await guardarHistorialOps();
      /* --- FIN NUEVO CÓDIGO --- */

      /* --- INICIO NUEVO CÓDIGO: CONSERVAR ESTADOS AL CARGAR MASTER --- */
      state.programacion = _importParsed.map(
        function(programa){
          const opPrevia = state.programacion.find(
            p => p.linea === programa.linea && String(p.op) === String(programa.op)
          );
          return { 
            ...programa,
            iniciada: opPrevia ? opPrevia.iniciada : false,
            cerrada: opPrevia ? opPrevia.cerrada : false,
            fechaCierre: opPrevia ? opPrevia.fechaCierre : null,
            cerradaPor: opPrevia ? opPrevia.cerradaPor : null
          };
        }
      );
      /* --- FIN NUEVO CÓDIGO --- */

      const guardado = await guardarProgramacion();

      renderProgramacion();
      actualizarOpOptions();
      actualizarReadout();
      renderDashboard();

      cerrarImportModal();

      await modalExito(
        'Programación cargada',
        'Se cargaron ' + state.programacion.length + ' OP desde MASTER.'
      );

    }catch(error){
      await modalError('No se pudo guardar', String(error.message || error));
    }finally{
      if (boton){
        boton.disabled = false;
        boton.textContent = 'Sí, reemplazar';
      }
    }
  });

/* ---------------- Exportar Histórico a Excel (.xlsx) ---------------- */
function exportarHistoricoXLSX(){
  if (!state.historico.length){
    modalAlerta('Sin datos', 'Todavía no hay registros en el Histórico para exportar.');
    return;
  }
  if (typeof XLSX === 'undefined'){
    modalError('Excel no disponible', 'No se pudo cargar el motor de Excel (requiere conexión a internet la primera vez). Verifica tu conexión e inténtalo de nuevo.');
    return;
  }

  const registros = state.historico.slice().sort((a,b)=>a.ts.localeCompare(b.ts));
  const filas = registros.map(r=>({
    'Fecha': fechaTexto(r.fecha),
    'Fecha Operativa': r.fechaOperativa ? fechaTexto(r.fechaOperativa) : '',
    'Hora': r.hora,
    'Línea': r.linea,
    'OP': r.op,
    'Acumulado Real': Math.round(r.acumulado),
    'Usuario': r.usuario,
    'Observación': r.observacion || '',
    'Cantidad Hora': Math.round(r.cantidadHora),
    'Estado Hora': r.estadoHora || '',
    'Plan Acumulado': Math.round(r.planAcumulado),
    'Diferencia': Math.round(r.diferencia),
    'Cumplimiento': r.cumplimiento,
    'Estado': r.estado,
  }));

  const ws = XLSX.utils.json_to_sheet(filas);
  const headers = Object.keys(filas[0]);
  const colCumplimiento = headers.indexOf('Cumplimiento');
  registros.forEach((r, i)=>{
    const addr = XLSX.utils.encode_cell({ r: i+1, c: colCumplimiento });
    if (ws[addr]) ws[addr].z = '0.0%';
  });
  ws['!cols'] = [
    {wch:11}, {wch:13}, {wch:9}, {wch:12}, {wch:14}, {wch:14}, {wch:12}, {wch:26}, {wch:12}, {wch:16}, {wch:13}, {wch:11}, {wch:13}, {wch:12} 
  ];
  ws['!autofilter'] = { ref: ws['!ref'] };
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, ws, 'PRODUCCION');
  XLSX.writeFile(wb, `historico_produccion_${fechaISO(new Date())}.xlsx`);
}

/* --- INICIO NUEVO CÓDIGO: AUTO-REFRESH TOTAL --- */
let pesoDatosAnterior = "";

async function verificarActualizaciones() {
  try {
    const histRaw = await storageGet(STORAGE_KEY_HIST) || "[]";
    const progRaw = await storageGet(STORAGE_KEY_PROG) || "[]";
    const opsRaw  = await storageGet(STORAGE_KEY_HISTORIAL_OPS) || "[]";

    const pesoActual = histRaw.length + "-" + progRaw.length + "-" + opsRaw.length;

    if (pesoDatosAnterior === "") {
      pesoDatosAnterior = pesoActual;
      return; 
    }

    if (pesoActual !== pesoDatosAnterior) {
      console.log("Nuevos datos detectados en BD. Actualizando pantalla...");
      await inicializarEstado();
      pesoDatosAnterior = pesoActual;
      renderTodo();
    }
  } catch (error) {
    console.error("Error validando actualizaciones:", error);
  }
}
/* --- FIN NUEVO CÓDIGO --- */

/* ---------------- Inicio de la aplicación ---------------- */
async function init(){
  await cargarConfiguracion();          
  await inicializarEstado();            
  poblarSelectLineas(document.getElementById('fLinea'), true);
  poblarSelectLineas(document.getElementById('pLinea'), false);

  document.getElementById('fUsuario').value = state.usuario || '';
  renderTodo();
  actualizarReloj();
  setInterval(actualizarReloj, 1000);
  
  setInterval(verificarActualizaciones, 20000);
}
init();