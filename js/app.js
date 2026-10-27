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
  const resultadoCorte = calcularCorteTurno({});

  let ultimoNumero = 0;
  if (state.cortesTurno.length > 0) {
      const ultimoCorte = state.cortesTurno[state.cortesTurno.length - 1];
      const partesId = ultimoCorte.id.split('-');
      if (partesId.length === 2) {
          ultimoNumero = parseInt(partesId[1], 10) || 0;
      }
  }
  const idFormateado = 'CORTE-' + String(ultimoNumero + 1).padStart(4, '0');
  const fechaCorrecta = fechaISO(new Date());

  const nuevoCorte = {
    id: idFormateado,
    fecha: fechaCorrecta,
    hora: horaTexto(new Date()),
    ...resultadoCorte
  };

  state.cortesTurno.push(nuevoCorte);
  await guardarCortesTurno();

  document.getElementById('corteOverlay').classList.remove('show');
  renderTodo();
  mostrarDetalleCorte(nuevoCorte);
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
    const alimRaw = await storageGet(STORAGE_KEY_ALIMENTACION) || "{}";

    const pesoActual = histRaw.length + "-" + progRaw.length + "-" + opsRaw.length + "-" + alimRaw.length;

    if (pesoDatosAnterior === "") {
      pesoDatosAnterior = pesoActual;
      return; 
    }

    if (pesoActual !== pesoDatosAnterior) {
      console.log("Nuevos datos detectados en BD. Actualizando pantalla...");
      await inicializarEstado();
      pesoDatosAnterior = pesoActual;
      renderTodo();
      renderHorariosAlim();
    }
  } catch (error) {
    console.error("Error validando actualizaciones:", error);
  }
}
/* --- FIN NUEVO CÓDIGO --- */

/* --- INICIO NUEVA LÓGICA: HORARIOS DE ALIMENTACIÓN (2 GRUPOS) Y PAUSAS ACTIVAS HOH --- */
function calcularHoraFinTexto(horaInicioStr, minutosSumar) {
  if (!horaInicioStr || !horaInicioStr.includes(':')) return 'Sin programar';
  const [h, m] = horaInicioStr.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 'Sin programar';
  const totalMin = (h * 60 + m + minutosSumar) % (24 * 60);
  const hh = String(Math.floor(totalMin / 60)).padStart(2, '0');
  const mm = String(totalMin % 60).padStart(2, '0');
  return `${horaInicioStr} → ${hh}:${mm}`;
}

function renderHorariosAlim() {
  const tbody = document.getElementById('tbodyHorariosAlim');
  if (!tbody) return;
  
  const filas = [
    { id: 'lv_t1', jornada: 'Lunes a Viernes', turno: 'Turno 1' },
    { id: 'lv_t2', jornada: 'Lunes a Viernes', turno: 'Turno 2' },
    { id: 'lv_t3', jornada: 'Domingo a Viernes', turno: 'Turno 3' }, 
    { id: 's_t1',  jornada: 'Sábados', turno: 'Turno 1' },
    { id: 's_t2',  jornada: 'Sábados', turno: 'Turno 2' },
    { id: 's_t3',  jornada: 'Sábados', turno: 'Turno 3' },
    { id: 'd_t1',  jornada: 'Domingos', turno: 'Turno 1' },
    { id: 'd_t2',  jornada: 'Domingos', turno: 'Turno 2' }
  ];

  // Paleta HOH: Rojo Neón para alertas/inactivo y Azul Claro para rangos activos
  const ESTILO_ROJO_NEON = 'color: #FF1744; font-weight: 700; text-shadow: 0 0 8px rgba(255, 23, 68, 0.35);';
  const ESTILO_AZUL_CLARO = 'color: #3E97E0; font-weight: 600;';

  tbody.innerHTML = filas.map(f => {
    const valG1 = state.horariosAlim[`${f.id}_g1`] || '';
    const valG2 = state.horariosAlim[`${f.id}_g2`] || '';
    const valPausa = state.horariosAlim[`${f.id}_pausa`] || '';
    
    const turnoInactivo = !valG1 && !valG2 && !valPausa;
    const sinG1 = !valG1;
    const sinG2 = !valG2;
    const sinPausa = !valPausa;

    const estiloG1 = sinG1 ? ESTILO_ROJO_NEON : ESTILO_AZUL_CLARO;
    const textoG1 = turnoInactivo ? '⚡ SIN OPERACIÓN' : (sinG1 ? '⚠️ FALTA G1' : calcularHoraFinTexto(valG1, 50));

    const estiloG2 = sinG2 ? ESTILO_ROJO_NEON : ESTILO_AZUL_CLARO;
    const textoG2 = turnoInactivo ? '⚡ SIN OPERACIÓN' : (sinG2 ? '⚠️ FALTA G2' : calcularHoraFinTexto(valG2, 50));

    const estiloPausa = sinPausa ? ESTILO_ROJO_NEON : ESTILO_AZUL_CLARO;
    const textoPausa = turnoInactivo ? '⚡ SIN OPERACIÓN' : (sinPausa ? '⚠️ FALTA PAUSA' : calcularHoraFinTexto(valPausa, 10));

    const estiloFila = turnoInactivo ? 'background: rgba(255, 23, 68, 0.04);' : '';
    
    // Si está inactivo se enciende en Rojo Neón; si tiene horas queda opaco
    const estiloBoton = turnoInactivo 
      ? 'color: #FF1744; border-color: #FF1744; background: rgba(255, 23, 68, 0.06); text-shadow: 0 0 8px rgba(255, 23, 68, 0.35); font-weight: 700;' 
      : 'color: var(--muted); border-color: var(--border); background: transparent; text-shadow: none; font-weight: normal;';

    return `
      <tr style="${estiloFila}">
        <td class="strong">${f.jornada}</td>
        <td>${f.turno}</td>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <input type="time" id="alim_${f.id}_g1" value="${valG1}" data-min="50" data-label="FALTA G1" data-badge="badge_${f.id}_g1" style="padding:6px 10px; border:1px solid var(--border); border-radius:4px; font-family:var(--font-display); outline:none;">
            <span id="badge_${f.id}_g1" style="font-size:11px; ${estiloG1}">${textoG1}</span>
          </div>
        </td>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <input type="time" id="alim_${f.id}_g2" value="${valG2}" data-min="50" data-label="FALTA G2" data-badge="badge_${f.id}_g2" style="padding:6px 10px; border:1px solid var(--border); border-radius:4px; font-family:var(--font-display); outline:none;">
            <span id="badge_${f.id}_g2" style="font-size:11px; ${estiloG2}">${textoG2}</span>
          </div>
        </td>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <input type="time" id="alim_${f.id}_pausa" value="${valPausa}" data-min="10" data-label="FALTA PAUSA" data-badge="badge_${f.id}_pausa" style="padding:6px 10px; border:1px solid var(--border); border-radius:4px; font-family:var(--font-display); outline:none;">
            <span id="badge_${f.id}_pausa" style="font-size:11px; ${estiloPausa}">${textoPausa}</span>
          </div>
        </td>
        <td>
          <button type="button" class="btn btn-ghost btn-sm" onclick="marcarTurnoSinOperacion('${f.id}', this)" style="${estiloBoton}" title="Dejar este turno sin operación ni cálculos">∅ Sin Operación</button>
        </td>
      </tr>
    `;
  }).join('');

  // Actualización visual inmediata al digitar una hora
  tbody.querySelectorAll('input[type="time"]').forEach(inp => {
    inp.addEventListener('input', () => {
      const badge = document.getElementById(inp.dataset.badge);
      const tr = inp.closest('tr');
      const btn = tr.querySelector('button');

      if (badge) {
        const minutos = Number(inp.dataset.min);
        if (inp.value) {
          badge.style.color = '#3E97E0';
          badge.style.fontWeight = '600';
          badge.style.textShadow = 'none';
          badge.textContent = calcularHoraFinTexto(inp.value, minutos);
        } else {
          badge.style.color = '#FF1744';
          badge.style.fontWeight = '700';
          badge.style.textShadow = '0 0 8px rgba(255, 23, 68, 0.35)';
          badge.textContent = `⚠️ ${inp.dataset.label}`;
        }
      }

      const valA1 = tr.querySelector('[id$="_g1"]').value;
      const valA2 = tr.querySelector('[id$="_g2"]').value;
      const valP  = tr.querySelector('[id$="_pausa"]').value;

      // Si hay al menos una hora ingresada, el botón vuelve a verse opaco
      if (valA1 || valA2 || valP) {
        btn.style.color = 'var(--muted)';
        btn.style.borderColor = 'var(--border)';
        btn.style.background = 'transparent';
        btn.style.textShadow = 'none';
        btn.style.fontWeight = 'normal';
        tr.style.background = 'transparent';
      } else {
        btn.style.color = '#FF1744';
        btn.style.borderColor = '#FF1744';
        btn.style.background = 'rgba(255, 23, 68, 0.06)';
        btn.style.textShadow = '0 0 8px rgba(255, 23, 68, 0.35)';
        btn.style.fontWeight = '700';
        tr.style.background = 'rgba(255, 23, 68, 0.04)';
      }
    });
  });
}

window.marcarTurnoSinOperacion = function(idTurno, btnEl) {
  ['g1', 'g2', 'pausa'].forEach(suf => {
    const input = document.getElementById(`alim_${idTurno}_${suf}`);
    if (input) input.value = '';
    const badge = document.getElementById(`badge_${idTurno}_${suf}`);
    if (badge) {
      badge.textContent = '⚡ SIN OPERACIÓN';
      badge.style.color = '#FF1744';
      badge.style.fontWeight = '700';
      badge.style.textShadow = '0 0 8px rgba(255, 23, 68, 0.35)';
    }
    state.horariosAlim[`${idTurno}_${suf}`] = '';
  });

  const filaBoton = btnEl ? btnEl.closest('tr') : (typeof event !== 'undefined' && event ? event.target.closest('tr') : null);
  if (filaBoton) {
    filaBoton.style.background = 'rgba(255, 23, 68, 0.04)';
    const btnOp = filaBoton.querySelector('button');
    if (btnOp) {
      btnOp.style.color = '#FF1744';
      btnOp.style.borderColor = '#FF1744';
      btnOp.style.background = 'rgba(255, 23, 68, 0.06)';
      btnOp.style.textShadow = '0 0 8px rgba(255, 23, 68, 0.35)';
      btnOp.style.fontWeight = '700';
    }
  }

  modalAlerta('Turno sin operación', `Se ha marcado el ${idTurno.toUpperCase()} como inactivo en Rojo Neón. Haz clic en "Guardar Horarios" para aplicar los cambios.`);
};

document.getElementById('btnGuardarAlimentacion')?.addEventListener('click', async () => {
   const claveIngresada = prompt('Ingrese la clave de analista para modificar los horarios de alimentación y pausas activas:');
   if (claveIngresada === null) return;

   if (claveIngresada.trim() !== ANALISTA_PIN) {
     await modalError('Acceso denegado', 'La clave de analista es incorrecta. No se guardaron los cambios.');
     return;
   }

   const inputs = document.querySelectorAll('input[type="time"][id^="alim_"]');
   inputs.forEach(inp => {
      const key = inp.id.replace('alim_', '');
      state.horariosAlim[key] = inp.value;
   });
   
   await guardarHorariosAlim();
   renderTodo();
   renderHorariosAlim();

   await modalExito(
     'Horarios Guardados', 
     'El sistema descontará automáticamente 50 minutos por grupo de alimentación y 10 minutos de pausas activas según los horarios establecidos.'
   );
});
/* --- FIN NUEVA LÓGICA --- */

/* ---------------- Inicio de la aplicación ---------------- */
async function init(){
  await cargarConfiguracion();          
  await inicializarEstado();            
  poblarSelectLineas(document.getElementById('fLinea'), true);
  poblarSelectLineas(document.getElementById('pLinea'), false);

  document.getElementById('fUsuario').value = state.usuario || '';
  renderTodo();
  renderHorariosAlim(); 
  
  actualizarReloj();
  setInterval(actualizarReloj, 1000);
  setInterval(verificarActualizaciones, 20000);
}
init();