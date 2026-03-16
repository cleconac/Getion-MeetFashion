// script.js — Versión final estable y robusta
// Basada en la última versión estable que tú indicabas.
// Copia/pega reemplazando todo el contenido anterior.

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {

    // --------- Helpers ----------
    const $id = id => document.getElementById(id);
    const $qs = sel => document.querySelector(sel);
    const exists = el => !!el;
    const safeAdd = (el, ev, fn) => { if (el && typeof el.addEventListener === 'function') el.addEventListener(ev, fn); };
    const fmtMX = v => {
      try { return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(v || 0)); }
      catch { return '$' + Number(v || 0).toFixed(2); }
    };
    const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,8);
    const warn = (...a) => console.warn('[gestor]', ...a);

    // --------- Storage keys ----------
    const KEY_STORES = 'mv_tiendas';
    const KEY_SALES = 'mv_ventas';
    const KEY_ACTIVE = 'mv_tienda_activa';
    const KEY_LOGO = 'mv_logo';

    // ---------- DOM lookups (try multiple ids to be tolerant) ----------
    const elNombreTienda = $id('nombreTienda') || $id('input-store-name') || $id('storeNameInput') || $id('nombre-tienda') || null;
    const elAgregarTienda = $id('agregarTienda') || $id('btn-add-store') || $id('addStoreBtn') || $id('agregar-tienda') || null;
    const elListaTiendas = $id('listaTiendas') || $id('stores-list') || $qs('.store-container') || $id('tiendas-container') || null;

    // Registro simple (superior)
    const elFechaVenta    = $id('fechaVenta') || $id('fecha-venta') || null;
    const elTurnoVenta    = $id('turnoVenta') || $id('turno-venta') || null;
    const elEfectivoVenta = $id('efectivoVenta') || $id('efectivo') || null;
    const elTarjetaVenta  = $id('tarjetaVenta') || $id('tarjeta') || null;
    const elRegistrarVenta= $id('registrarVenta') || $id('registrar-venta') || null;

    // filas / registro avanzado
    const elAgregarFila   = $id('agregarFila') || $id('agregar-fila') || $id('btn-add-row') || null;
    const elGenerarRango  = $id('generarRango') || $id('generar-rango') || null;
    // Prefer registration container (where rows must go)
    const regRowsContainer = $id('filas-registro') || $id('registro-filas') || $id('registro-ventas') || $qs('#registro-ventas') || null;

    // Import file + import button (we create button if not present)
    const elImportFile    = $id('importarExcel') || $id('archivo-excel') || $id('file-import') || $id('importFile') || null;
    let elBtnImportar     = $id('btnImportar') || $id('btn-import') || $id('importar-guardar') || null;

    // filtros / detalle
    const elFilterDesde   = $id('fechaInicio') || $id('fecha-desde') || null;
    const elFilterHasta   = $id('fechaFin') || $id('fecha-hasta') || null;
    const elFilterTipoPago= $id('tipoPago') || null;
    const elFilterTurno   = $id('turnoFiltro') || null;
    const elFilterVista   = $id('vistaPor') || null;
    const elBtnApply      = $id('aplicarFiltros') || $id('aplicar-filtros') || null;
    const elBtnExport     = $id('exportarExcel') || $id('exportar') || null;
    const filtroAnio = document.getElementById("filtroAnio").value;

    // table body for details
    const elTablaBody     = ($qs('#tablaVentas tbody')) ? $qs('#tablaVentas tbody') : ($qs('#sales-table tbody') || $id('tabla-ventas-body') || null);
    const detalleWrapper  = $id('detalle-ventas-wrapper') || $id('detalle-ventas') || null;
    const elPrev          = $id('prevPage') || null;
    const elNext          = $id('nextPage') || null;
    const elPageInfo      = $id('pageInfo') || null;

    // canvas chart (optional)
    const elCanvas        = $id('graficoVentas') || $id('chart') || null;

    // logo (optional)
    const logoInput       = $id('logo-input') || null;
    const logoImg         = $id('logo-img') || null;

    // --------- State ----------
    let stores = [];
    let sales  = [];
    //  Resumen  financiero
    let  ultimaListaFiltrada =  [];
    let  finPage  =  1;
    const  finRowsPerPage  =  10;
    let  finData  =  [];
    let cfPage  =  1;
    const cfRowsPerPage  =  10;
    let cfData  =  [];
    let  yoyPage =  1;
    const  yoyRowsPerPage =  10;
    let  yoyData =  [];
    let  rkPage  =  1;
    const  rkRowsPerPage  =  10;
    let  rkData  =  [];

    try { stores = JSON.parse(localStorage.getItem(KEY_STORES) || '[]'); } catch(e){ stores = []; }
    try { sales  = JSON.parse(localStorage.getItem(KEY_SALES) || '[]'); } catch(e){ sales = []; }

    if (!Array.isArray(stores) || stores.length === 0) stores = [{ name: 'Tienda Principal', active: true }];
    stores = stores.map(s => (typeof s === 'string' ? { name: s, active: false } : s));
    if (!stores.some(s => s.active)) stores[0].active = true;

    let activeStore = localStorage.getItem(KEY_ACTIVE) || (stores.find(s=>s.active) ? stores.find(s=>s.active).name : stores[0].name);
    stores.forEach(s => s.active = (s.name === activeStore));

    // pagination
    let currentPage = 1;
    const rowsPerPage = 10;
    let chartInstance = null;
    const  rankingRowsPerPage =  10;
    let  rankingPage  =  1;

    // --------- Persistence ----------
    function saveStores() { try { localStorage.setItem(KEY_STORES, JSON.stringify(stores)); } catch(e){ console.error(e); } }
    function saveSales()  { try { localStorage.setItem(KEY_SALES, JSON.stringify(sales)); } catch(e){ console.error(e); } }
    function saveActive() { try { localStorage.setItem(KEY_ACTIVE, stores.find(s=>s.active)?.name || stores[0].name); } catch(e){ console.error(e); } }

    // --------- Fecha normalize ----------
    function normalizeFecha(fecha) {
      if (!fecha && fecha !== 0) return '';
      if (Object.prototype.toString.call(fecha) === '[object Date]') {
        if (isNaN(fecha)) return '';
        return fecha.toISOString().slice(0,10);
      }
      if (typeof fecha === 'number') {
        const base = new Date(1899,11,30);
        const d = new Date(base.getTime() + fecha * 86400000);
        return d.toISOString().slice(0,10);
      }
      if (typeof fecha === 'string') {
        const s = fecha.trim();
        if (!s) return '';
        const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (iso) return `${iso[1]}-${String(iso[2]).padStart(2,'0')}-${String(iso[3]).padStart(2,'0')}`;
        const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (dmy) return `${dmy[3]}-${String(dmy[2]).padStart(2,'0')}-${String(dmy[1]).padStart(2,'0')}`;
        const dt = new Date(s);
        if (!isNaN(dt)) return dt.toISOString().slice(0,10);
        return s;
      }
      return String(fecha);
    }

    // --------- Toast ----------
    function showToast(msg, type='info') {
      try {
        const el = document.createElement('div');
        el.className = `gf-toast gf-${type}`;
        el.textContent = msg;
        document.body.appendChild(el);
        requestAnimationFrame(()=> el.classList.add('visible'));
        setTimeout(()=> { el.classList.remove('visible'); setTimeout(()=> el.remove(),300); }, 1600);
      } catch(e){ console.log(msg); }
    }

//  ==========================
// ===  RESUMEN  FINANCIERO  ===
//  ==========================

function  getISOWeek(fechaStr)  {
    const  fecha  =  new  Date(fechaStr);
   if  (isNaN(fecha))  return  null;

    const  target  =  new  Date(fecha.valueOf());
    const  dayNr  =  (fecha.getDay()  + 6)  %  7;
    target.setDate(target.getDate()  -  dayNr  +  3);

    const  firstThursday  =  new  Date(target.getFullYear(),  0, 4);
    const  diff  =  target  -  firstThursday;
    const  week  =  1  +  Math.round(diff  /  (7 *  24  *  60  *  60  *  1000));

    return  `${target.getFullYear()}-W${String(week).padStart(2,  '0')}`;
}

function  agruparVentasPorSemana(lista)  {
   const  semanas  =  {};

    lista.forEach(v  =>  {
        const  fecha  = normalizeFecha(v.fecha);
        const  semana  =  getISOWeek(fecha);
        if  (!semana)  return;

       const  total  =  (Number(v.efectivo)  ||  0)  +  (Number(v.tarjeta)  ||  0);

        if  (!semanas[semana]) semanas[semana]  =  0;
        semanas[semana]  +=  total;
    });

    return  semanas;
}

 function  calcularResumenFinancieroDesdeGrouped(grouped)  {
    const  pctResurtido =  Number($id('fin_pct_resurtido')?.value  ||  0);
    const  nominaFija     =  Number($id('fin_nomina_fija')?.value ||  0);
    const  renta              =  Number($id('fin_renta')?.value  || 0);
     const bonoMil           =  Number($id('fin_bono_mil')?.value ||  0);
 
    const  filas  = [];
 
    grouped.forEach(r  =>  {
        // r.periodLabel  es  algo  como "2025-W03"  cuando  vista  = semana
        const  semana  = r.periodLabel  ||  r.fecha  || 'N/A';
        const  ventas  = Number(r.total  ||  0);
 
       const  excedente  =  Math.max(0, ventas  -  35000);
        const  bloques  =  Math.max(0,  Math.floor((ventas  -  35000)  /  1000));
        const bono           =  bloques *  bonoMil;
 
        const resurtido      = ventas  *  (pctResurtido  / 100);
        const  gastosFijos  = nominaFija  +  renta;
        const utilidad       =  ventas  -  resurtido -  gastosFijos  -  bono;

        filas.push({
           semana,
            ventas,
           pctResurtido,
           resurtido,
           gastosFijos,
            gastosVariables: bono,
            utilidad
       });
     });

     return filas;
 }


function  calcularResumenFinanciero(datos)  {
    const  pctResurtido  =  Number($id('fin_pct_resurtido')?.value  ||  0);
    const  nominaFija      = Number($id('fin_nomina_fija')?.value  ||  0);
    const  renta                =  Number($id('fin_renta')?.value  ||  0);
   const  bonoMil            =  Number($id('fin_bono_mil')?.value  ||  0);

    const  semanas  =  agruparVentasPorSemana(datos);
   const  filas  =  [];

    Object.keys(semanas).sort().forEach(sem  =>  {
        const  ventas  = semanas[sem];

        const  excedente  =  Math.max(0,  ventas  -  35000);
        const  bloques     =  Math.floor(excedente  /  1000);
        const  bono            =  bloques *  bonoMil;

        const  resurtido      =  ventas  *  (pctResurtido  /  100);
       const  gastosFijos  =  nominaFija  +  renta;
        const  utilidad        =  ventas -  resurtido  -  gastosFijos  -  bono;

        filas.push({
            semana: sem,
            ventas,
            pctResurtido,
           resurtido,
            gastosFijos,
            gastosVariables:  bono,
           utilidad
        });
    });

    return  filas;
}

function  renderResumenFinanciero(filas)  {
    const  card    =  $id('resumen-financiero-card');
    const  tbody  =  $id('tbodyResumenFinanciero');
    const  pag      =  $id('fin-pagination');
    const  info    =  $id('fin-page-info');

    if  (!card  ||  !tbody)  return;

    if  (!filas  ||  filas.length  ===  0)  {
       card.style.display  =  'none';
        tbody.innerHTML  =  '';
        if  (pag)  pag.style.display  =  'none';
        return;
    }

    //  Guardar  datos  para  paginación
    finData  =  filas;
    card.style.display  =  'block';

    const  totalPages  =  Math.ceil(finData.length  /  finRowsPerPage);
    if  (finPage  >  totalPages)  finPage  =  totalPages;

    const  start  =  (finPage  -  1)  *  finRowsPerPage;
    const  end      =  start  +  finRowsPerPage;
    const  pageRows  =  finData.slice(start,  end);

    tbody.innerHTML  =  '';

    pageRows.forEach(f  =>  {
        const  tr  =  document.createElement('tr');
        tr.innerHTML  =  `
            <td>${f.semana}</td>
            <td>${fmtMX(f.ventas)}</td>
            <td>${f.pctResurtido}%</td>
            <td>${fmtMX(f.resurtido)}</td>
            <td>${fmtMX(f.gastosFijos)}</td>
            <td>${fmtMX(f.gastosVariables)}</td>
            <td>${fmtMX(f.utilidad)}</td>
        `;
        tbody.appendChild(tr);
    });

    //  Mostrar  paginación
    if  (pag)  {
        pag.style.display  =  'flex';
        info.textContent  = `Página  ${finPage}  de  ${totalPages}`;
    }
}



    // --------- Render stores ----------
    function renderStores() {
      if (!elListaTiendas) { warn('Contenedor tiendas no encontrado'); return; }
      elListaTiendas.innerHTML = '';
      stores.forEach((s, idx) => {
        const wrap = document.createElement('div');
        wrap.className = 'store-item';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'switch' + (s.active ? ' active' : '');
        btn.innerHTML = `<span class="store-name">${s.name}</span>`;
        safeAdd(btn, 'click', () => {
          stores.forEach(x => x.active = false);
          s.active = true;
          activeStore = s.name;
          saveStores(); saveActive();
          renderStores();
        });

        const edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'store-edit store-icon';
        edit.title = 'Editar';
        edit.innerHTML = '✏️';
        safeAdd(edit, 'click', (e) => {
          e.stopPropagation();
          const nuevo = prompt('Nuevo nombre de tienda:', s.name);
          if (nuevo && nuevo.trim()) {
            const old = s.name;
            s.name = nuevo.trim();
            if (activeStore === old) activeStore = s.name;
            saveStores();
            renderStores();
            showToast('Tienda renombrada', 'success');
          }
        });

        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'store-del store-icon';
        del.title = 'Eliminar';
        del.innerHTML = '❌';
        safeAdd(del, 'click', (e) => {
          e.stopPropagation();
          if (!confirm(`¿Eliminar la tienda "${s.name}"?`)) return;
          stores.splice(idx, 1);
          if (activeStore === s.name) activeStore = stores[0] ? stores[0].name : '';
          saveStores(); saveActive();
          renderStores();
          showToast('Tienda eliminada', 'info');
        });

        wrap.appendChild(btn);
        wrap.appendChild(edit);
        wrap.appendChild(del);
        elListaTiendas.appendChild(wrap);
      });
      saveStores();
    }

    // --------- Add store ----------
    if (elAgregarTienda && elNombreTienda) {
      safeAdd(elAgregarTienda, 'click', () => {
        const v = (elNombreTienda.value || '').trim();
        if (!v) { alert('Ingresa nombre de tienda'); elNombreTienda.focus(); return; }
        if (stores.some(s => s.name === v)) { alert('La tienda ya existe'); elNombreTienda.select(); return; }
        stores.forEach(s => s.active = false);
        stores.push({ name: v, active: true });
        activeStore = v;
        saveStores(); saveActive();
        elNombreTienda.value = '';
        renderStores();
        showToast('Tienda agregada', 'success');
      });
      safeAdd(elNombreTienda, 'keydown', e => { if (e.key === 'Enter') elAgregarTienda.click(); });
    } else {
      warn('Agregar tienda no encontrado: ids esperados nombreTienda + agregarTienda');
    }

    // --------- Registrar venta (form superior) ----------
    // ensure Registrar button is disabled initially (if exists)
    if (elRegistrarVenta) { try { elRegistrarVenta.disabled = true; } catch(e){} }

    function updateRegistrarState() {
      if (!elRegistrarVenta) return;
      try {
        const fechaVal = elFechaVenta ? elFechaVenta.value : '';
        // important: do NOT assume turno has default value — user must SELECT it
        const turnoVal = elTurnoVenta ? elTurnoVenta.value : '';
        const efectivo = elEfectivoVenta ? parseFloat(elEfectivoVenta.value || 0) : 0;
        const tiendaAct = stores.find(s => s.active);
        const enable = !!(fechaVal && turnoVal && tiendaAct && efectivo > 0);
        elRegistrarVenta.disabled = !enable;
      } catch (e) { elRegistrarVenta.disabled = false; }
    }

    safeAdd(elFechaVenta, 'input', updateRegistrarState);
    safeAdd(elTurnoVenta, 'change', updateRegistrarState);
    safeAdd(elEfectivoVenta, 'input', updateRegistrarState);

    safeAdd(elRegistrarVenta, 'click', () => {
      try {
        const tiendaObj = stores.find(s => s.active) || stores[0];
        if (!tiendaObj) { alert('Selecciona una tienda'); return; }
        const fecha = elFechaVenta ? elFechaVenta.value : '';
        if (!fecha) { alert('Selecciona una fecha'); return; }
        const turno = elTurnoVenta ? elTurnoVenta.value : '';
        if (!turno) { alert('Selecciona un turno'); return; }
        const efectivo = elEfectivoVenta ? parseFloat(elEfectivoVenta.value || 0) : 0;
        const tarjeta = elTarjetaVenta ? parseFloat(elTarjetaVenta.value || 0) : 0;
        const nf = normalizeFecha(fecha);
        const idx = sales.findIndex(s => s.tienda === tiendaObj.name && s.fecha === nf && s.turno.toLowerCase() === turno.toLowerCase());
        const rec = { id: idx>=0 ? sales[idx].id : uid(), tienda: tiendaObj.name, fecha: nf, turno, efectivo:+efectivo.toFixed(2), tarjeta:+tarjeta.toFixed(2), total:+(efectivo+tarjeta).toFixed(2) };
        if (idx>=0) sales[idx] = rec; else sales.push(rec);
        saveSales();
        // clear inputs
        if (elFechaVenta) elFechaVenta.value = '';
        if (elTurnoVenta && elTurnoVenta.options && elTurnoVenta.options[0]) elTurnoVenta.value = '';
        if (elEfectivoVenta) elEfectivoVenta.value = '';
        if (elTarjetaVenta) elTarjetaVenta.value = '';
        updateRegistrarState();
        showToast('Venta registrada', 'success');
      } catch (e) { console.error(e); alert('Error al registrar venta'); }
    });

    // --------- Rows (registration) ----------
    function addEntryRow(fecha = '', turno = '', efectivo = '', tarjeta = '') {
      const container = regRowsContainer || elTablaBody;
      if (!container) { warn('No se detectó contenedor para filas de registro'); return; }

      // If container is table body, create <tr>, else create a div row in registration section
      if (container === elTablaBody) {
        const tr = document.createElement('tr');
        tr.className = 'editable-row';
        const storeOptions = stores.map(s => `<option value="${s.name}" ${s.active ? 'selected':''}>${s.name}</option>`).join('');
        tr.innerHTML = `
          <td><input type="date" class="row-fecha" value="${fecha}"></td>
          <td><select class="row-store">${storeOptions}</select></td>
          <td><select class="row-turno"><option value="">--</option><option value="matutino" ${turno==='matutino'?'selected':''}>Matutino</option><option value="vespertino" ${turno==='vespertino'?'selected':''}>Vespertino</option></select></td>
          <td><input class="row-efectivo" type="number" step="0.01" value="${efectivo}"></td>
          <td><input class="row-tarjeta" type="number" step="0.01" value="${tarjeta}"></td>
          <td><button class="row-save" disabled>Guardar</button> <button class="row-remove">Eliminar</button></td>
        `;
        container.prepend(tr);
        wireRowEvents(tr);
        validateRowInputs(tr);
      } else {
        const div = document.createElement('div');
        div.className = 'registro-flex';
        div.innerHTML = `
	  <div>
          <label>Fecha:</label>
          <input type="date" class="row-fecha" value="${fecha}">
          </div>
	  <div>
          <label>Tienda:</label>
          <select class="row-store">${stores.map(s => `<option value="${s.name}" ${s.active ? 'selected':''}>${s.name}</option>`).join('')}</select>
	  </div>
	  <div>
          <label>Turno:</label>
          <select class="row-turno"><option value="">--</option><option value="matutino" ${turno==='matutino'?'selected':''}>Matutino</option><option value="vespertino" ${turno==='vespertino'?'selected':''}>Vespertino</option></select>
	  </div>
	  <div>
          <label>Efectivo:</label>
          <input class="row-efectivo" type="number" step="0.01" value="${efectivo}" placeholder="$0.00">
	  </div>
	  <div>
          <label>Tarjeta:</label>
          <input class="row-tarjeta" type="number" step="0.01" value="${tarjeta}" placeholder="$0.00">
	  </div>
	  <div>
          <button class="row-save" disabled>Guardar</button>
          <button class="row-remove">Eliminar</button>
	  </div>
        `;
        container.appendChild(div);
        wireRowEvents(div);
        validateRowInputs(div);
      }
    }

    function wireRowEvents(elRow) {
      if (!elRow) return;
      const selDate = elRow.querySelector('.row-fecha');
      const selTurno = elRow.querySelector('.row-turno');
      const selEfect = elRow.querySelector('.row-efectivo');
      const btnSave = elRow.querySelector('.row-save');
      const btnRemove = elRow.querySelector('.row-remove');

      [selDate, selTurno, selEfect].forEach(inp => {
        if (inp) safeAdd(inp, 'input', () => validateRowInputs(elRow));
        if (inp) safeAdd(inp, 'change', () => validateRowInputs(elRow));
      });

      if (btnSave) safeAdd(btnSave, 'click', () => saveRowFromElement(elRow));
      if (btnRemove) safeAdd(btnRemove, 'click', () => elRow.remove());
    }

    function validateRowInputs(elRow) {
      if (!elRow) return;
      const fechaEl = elRow.querySelector('.row-fecha');
      const turnoEl = elRow.querySelector('.row-turno');
      const efEl = elRow.querySelector('.row-efectivo');
      const btnSave = elRow.querySelector('.row-save');
      const fecha = fechaEl ? fechaEl.value : '';
      const turno = turnoEl ? turnoEl.value : '';
      const ef = efEl ? parseFloat(efEl.value || 0) : 0;
      if (btnSave) btnSave.disabled = !(fecha && turno && ef > 0);
    }

    function saveRowFromElement(elRow) {
      try {
        const fEl = elRow.querySelector('.row-fecha');
        const storeEl = elRow.querySelector('.row-store');
        const turnoEl = elRow.querySelector('.row-turno');
        const efEl = elRow.querySelector('.row-efectivo');
        const taEl = elRow.querySelector('.row-tarjeta');
        const fechaVal = fEl ? fEl.value : '';
        if (!fechaVal) { alert('Ingresa fecha'); return; }
        const storeVal = storeEl ? storeEl.value : (stores[0] ? stores[0].name : 'Tienda Principal');
        const turnoVal = turnoEl ? turnoEl.value : 'matutino';
        const ef = efEl ? parseFloat(efEl.value || 0) : 0;
        const ta = taEl ? parseFloat(taEl.value || 0) : 0;
        const nfecha = normalizeFecha(fechaVal);
        const idx = sales.findIndex(s => s.tienda === storeVal && s.fecha === nfecha && s.turno.toLowerCase() === turnoVal.toLowerCase());
        const rec = { id: idx>=0 ? sales[idx].id : uid(), tienda: storeVal, fecha: nfecha, turno: turnoVal, efectivo:+ef.toFixed(2), tarjeta:+ta.toFixed(2), total:+(ef+ta).toFixed(2) };
        if (idx>=0) sales[idx] = rec; else sales.push(rec);
        saveSales();
        showToast('Registro guardado', 'success');
        // remove input row to keep UX clean if it was in registration container
        if (regRowsContainer && regRowsContainer.contains(elRow)) elRow.remove();
        renderVentas(); // detail stays hidden unless filters applied
      } catch (err) { console.error(err); alert('Error al guardar fila'); }
    }

    // wire add row and generate range safely
    safeAdd(elAgregarFila, 'click', () => addEntryRow());

safeAdd(elGenerarRango, 'click', () => {
  abrirCalendarioRango("Seleccionar rango de registro", (inicio, fin, dobleTurno) => {
    for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) {
      const fechaISO = d.toISOString().slice(0, 10);
      if (dobleTurno) {
        addEntryRow(fechaISO, "matutino");
        addEntryRow(fechaISO, "vespertino");
      } else {
        // por defecto crear solo matutino; si quieres otro comportamiento cámbialo
        addEntryRow(fechaISO, "matutino");
      }
    }
    showToast("Rango generado exitosamente", "success");
  }, { dobleTurno: true });
});


// === APLICAR CALENDARIO A FILTROS Y REPORTE ===
safeAdd(document.getElementById("btnRangoFiltro"), "click", () => {
  abrirCalendarioRango("Seleccionar rango de filtro", (inicio, fin) => {
    // Asegurarse de que los inputs existen y setear valor en formato ISO (YYYY-MM-DD)
    const inEl = document.getElementById("fechaInicio") || elFilterDesde;
    const outEl = document.getElementById("fechaFin") || elFilterHasta;

    const isoInicio = inicio.toISOString().slice(0,10);
    const isoFin = fin.toISOString().slice(0,10);

    if (inEl) inEl.value = isoInicio;
    if (outEl) outEl.value = isoFin;

    // Si se usan otros detectores (por seguridad), disparar evento 'change' para que cualquier listener reaccione
    [inEl, outEl].forEach(inp => {
      if (inp) {
        try { inp.dispatchEvent(new Event('change', { bubbles: true })); } catch(e){}
      }
    });

    // Actualizar el estado de botones (habilitar aplicar/exportar)
    try { updateFilterButtonsState(); } catch(e){}

    showToast("Rango de fechas aplicado correctamente", "success");
  });
});


// === FUNCIÓN REUTILIZABLE PARA ABRIR CALENDARIO ===
function abrirCalendarioRango(titulo, callbackConfirmar, opciones = {}) {
  const { dobleTurno = false } = opciones;

  let modal = document.getElementById("calendar-modal");
  if (modal) modal.remove();

  modal = document.createElement("div");
  modal.id = "calendar-modal";
  modal.style.position = "fixed";
  modal.style.top = "0";
  modal.style.left = "0";
  modal.style.width = "100vw";
  modal.style.height = "100vh";
  modal.style.background = "rgba(0,0,0,0.5)";
  modal.style.display = "flex";
  modal.style.justifyContent = "center";
  modal.style.alignItems = "center";
  modal.style.zIndex = "9999";

modal.innerHTML = `
  <div class="calendar-modal-content">
    <div class="calendar-header">
      <div class="calendar-nav">
        <button id="prev-year" class="nav-btn">«</button>
        <button id="prev-month" class="nav-btn">‹</button>
      </div>
      <h3 id="calendar-title">${titulo}</h3>
      <div class="calendar-nav">
        <button id="next-month" class="nav-btn">›</button>
        <button id="next-year" class="nav-btn">»</button>
      </div>
    </div>
    <div id="calendar-container"></div>
    <p id="range-display" style="margin:10px 0; font-weight:600;">Sin seleccionar</p>
    <div class="calendar-actions">
      <button id="confirm-range" disabled>Confirmar</button>
      <button id="cancel-range">Cancelar</button>
    </div>
  </div>
`;

  document.body.appendChild(modal);

  let viewDate = new Date();
  let selectedStart = null;
  let selectedEnd = null;

  const container = modal.querySelector("#calendar-container");
  const titleEl = modal.querySelector("#calendar-title");
  const rangeDisplay = modal.querySelector("#range-display");
  const confirmBtn = modal.querySelector("#confirm-range");
  const cancelBtn = modal.querySelector("#cancel-range");

  const diasSemana = ["D", "L", "M", "M", "J", "V", "S"];

  function renderCalendar() {
    container.innerHTML = "";
    diasSemana.forEach(d => {
      const dayHeader = document.createElement("div");
      dayHeader.textContent = d;
      dayHeader.classList.add("calendar-day-header");
      container.appendChild(dayHeader);
    });

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    titleEl.textContent = `${viewDate.toLocaleString("es-ES", { month: "long" }).toUpperCase()} ${year}`;

    const firstDay = new Date(year, month, 1);
    const startDay = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < startDay; i++) {
      const empty = document.createElement("div");
      container.appendChild(empty);
    }

for (let day = 1; day <= daysInMonth; day++) {
  const date = new Date(year, month, day);
  const dayEl = document.createElement("div");
  dayEl.textContent = day;
  dayEl.dataset.date = date.toISOString().split("T")[0];
  dayEl.classList.add("calendar-day");
  dayEl.addEventListener("click", () => selectDate(date));

  // animación hover opcional (BestDay-like)
  dayEl.addEventListener("mouseenter", () => dayEl.classList.add("hovering"));
  dayEl.addEventListener("mouseleave", () => dayEl.classList.remove("hovering"));

  container.appendChild(dayEl);
}


    highlightSelection();
  }

function selectDate(date) {
  // Convertir siempre a ISO string (YYYY-MM-DD)
  const iso = date.toISOString().split("T")[0];

  // Lógica de selección
  if (!selectedStart || (selectedStart && selectedEnd)) {
    selectedStart = iso;
    selectedEnd = null;
  } else if (iso < selectedStart) {
    selectedEnd = selectedStart;
    selectedStart = iso;
  } else {
    selectedEnd = iso;
  }

  // Actualizar visual
  highlightSelection();
  updateDisplay();

  // Habilitar confirmación si hay inicio y fin
  confirmBtn.disabled = !(selectedStart && selectedEnd);
}

function highlightSelection() {
  const container = document.querySelector("#calendar-container");
  if (!container) return;

  const dayEls = container.querySelectorAll("div[data-date]");
  if (!dayEls.length) return;

  dayEls.forEach(el => {
    const date = el.dataset.date;
    el.classList.remove("start", "end", "in-range");

    if (selectedStart && selectedEnd) {
      if (date === selectedStart) {
        el.classList.add("start");
      } else if (date === selectedEnd) {
        el.classList.add("end");
      } else if (date > selectedStart && date < selectedEnd) {
        el.classList.add("in-range");
      }
    } else if (selectedStart && !selectedEnd && date === selectedStart) {
      el.classList.add("start");
    }
  });
}


function updateDisplay() {
  const fmt = d => {
    if (!d) return "";
    // Acepta tanto Date como string ISO
    if (typeof d === "string") {
      try {
        const dd = new Date(d + "T00:00:00");
        return dd.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
      } catch {
        return d;
      }
    }
    if (Object.prototype.toString.call(d) === "[object Date]") {
      return d.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
    }
    return String(d);
  };

  if (selectedStart && selectedEnd) {
    rangeDisplay.textContent = `Del ${fmt(selectedStart)} al ${fmt(selectedEnd)}`;
  } else if (selectedStart) {
    rangeDisplay.textContent = `Inicio: ${fmt(selectedStart)}`;
  } else {
    rangeDisplay.textContent = "Sin seleccionar";
  }
}


  modal.querySelector("#prev-month").addEventListener("click", () => { viewDate.setMonth(viewDate.getMonth() - 1); renderCalendar(); });
  modal.querySelector("#next-month").addEventListener("click", () => { viewDate.setMonth(viewDate.getMonth() + 1); renderCalendar(); });
  modal.querySelector("#prev-year").addEventListener("click", () => { viewDate.setFullYear(viewDate.getFullYear() - 1); renderCalendar(); });
  modal.querySelector("#next-year").addEventListener("click", () => { viewDate.setFullYear(viewDate.getFullYear() + 1); renderCalendar(); });

  cancelBtn.addEventListener("click", () => modal.remove());

confirmBtn.addEventListener("click", () => {
  if (selectedStart && selectedEnd) {
    // Convertir a Date si vienen como string
    const inicio = (typeof selectedStart === "string") ? new Date(selectedStart + "T00:00:00") : selectedStart;
    const fin = (typeof selectedEnd === "string") ? new Date(selectedEnd + "T00:00:00") : selectedEnd;
    callbackConfirmar(inicio, fin, dobleTurno);
  }
  modal.remove();
});


  renderCalendar();
}



    // --------- Import button ensure + wiring ----------
    function ensureImportButton() {
      if (elBtnImportar) return elBtnImportar;
      if (!elImportFile) { warn('Input archivo no encontrado — import deshabilitado'); return null; }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'btnImportar';
      btn.textContent = 'Importar y guardar registros';
      btn.disabled = true;
      elImportFile.insertAdjacentElement('afterend', btn);
      elBtnImportar = btn;
      return elBtnImportar;
    }
    const importBtn = ensureImportButton();

    if (elImportFile && importBtn) {
      safeAdd(elImportFile, 'change', () => { importBtn.disabled = !(elImportFile.files && elImportFile.files.length > 0); });
      safeAdd(importBtn, 'click', async () => {
        const f = elImportFile.files && elImportFile.files[0];
        if (!f) { alert('Selecciona un archivo'); return; }
        importBtn.disabled = true; importBtn.textContent = 'Importando...';
        try {
          const name = f.name.toLowerCase();
          let rows = [];
          if (name.endsWith('.csv')) {
            const text = await f.text();
            rows = csvToObjects(text);
          } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
            if (window.XLSX) {
              const ab = await f.arrayBuffer();
              const wb = XLSX.read(ab, { type: 'array' });
              const sheet = wb.Sheets[wb.SheetNames[0]];
              rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
            } else throw new Error('Falta librería XLSX para .xlsx (agrega xlsx.full.min.js)');
          } else throw new Error('Formato no soportado');

          if (!rows.length) { alert('No se encontraron filas en el archivo'); return; }

          let added = 0, replaced = 0;
          rows.forEach(r => {
            const mapKey = key => {
              const keys = Object.keys(r);
              for (const k of keys) if (String(k).trim().toLowerCase() === key.toLowerCase()) return r[k];
              return undefined;
            };
            const fechaRaw = mapKey('fecha') ?? mapKey('Fecha') ?? r.Fecha ?? r.Date ?? '';
            const tiendaRaw = mapKey('tienda') ?? mapKey('store') ?? r.Tienda ?? r.Store ?? stores[0].name;
            const turnoRaw = mapKey('turno') ?? mapKey('shift') ?? r.Turno ?? r.Shift ?? 'matutino';
            const efectivoRaw = mapKey('efectivo') ?? mapKey('cash') ?? r.Efectivo ?? r.Cash ?? 0;
            const tarjetaRaw = mapKey('tarjeta') ?? mapKey('card') ?? r.Tarjeta ?? r.Card ?? 0;

            const fechaNorm = normalizeFecha(fechaRaw);
            if (!fechaNorm) return;
            const tiendaName = (String(tiendaRaw || '')).trim() || stores[0].name;
            if (!stores.some(s => s.name === tiendaName)) { stores.forEach(s => s.active = false); stores.push({ name: tiendaName, active: true }); saveStores(); }
            const turno = (String(turnoRaw || 'matutino')).toLowerCase();
            const efectivo = Number(String(efectivoRaw).replace(/[^0-9\.\-]/g,'')) || 0;
            const tarjeta = Number(String(tarjetaRaw).replace(/[^0-9\.\-]/g,'')) || 0;
            const total = +(efectivo + tarjeta);
            const idx = sales.findIndex(s => s.tienda === tiendaName && s.fecha === fechaNorm && s.turno.toLowerCase() === turno.toLowerCase());
            const rec = { id: idx>=0 ? sales[idx].id : uid(), tienda: tiendaName, fecha: fechaNorm, turno, efectivo:+efectivo.toFixed(2), tarjeta:+tarjeta.toFixed(2), total:+total.toFixed(2) };
            if (idx>=0) { sales[idx] = rec; replaced++; } else { sales.push(rec); added++; }
          });

          saveSales(); saveStores(); saveActive();
          elImportFile.value = '';
          importBtn.textContent = 'Importar y guardar registros';
          alert(`Importación completada. Añadidos: ${added}. Reemplazados: ${replaced}.`);
          showToast('Importación exitosa', 'success');
          renderStores();
        } catch (err) {
          console.error(err);
          alert('Error al importar: ' + (err && err.message ? err.message : err));
        } finally {
          importBtn.disabled = true;
          importBtn.textContent = 'Importar y guardar registros';
        }
      });
    }

    function csvToObjects(text) {
      const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
      if (!lines.length) return [];
      const header = parseCsvLine(lines[0]).map(h => h.trim());
      const out = [];
      for (let i=1;i<lines.length;i++){
        const parts = parseCsvLine(lines[i]);
        if (!parts.length) continue;
        const obj = {};
        for (let j=0;j<header.length;j++){
          obj[header[j]] = parts[j] !== undefined ? parts[j] : '';
        }
        out.push(obj);
      }
      return out;
    }
    function parseCsvLine(line) {
      const out = []; let cur=''; let inQ=false;
      for (let i=0;i<line.length;i++){
        const ch = line[i];
        if (ch === '"') {
          if (inQ && line[i+1] === '"') { cur += '"'; i++; }
          else inQ = !inQ;
        } else if (ch === ',' && !inQ) { out.push(cur); cur=''; }
        else cur += ch;
      }
      out.push(cur);
      return out;
    }

    // --------- Filters / Grouping / Render ----------
function getFilteredRaw() {
  let rows = sales.slice();

  const filtroTienda = $id('filtroTienda') || null;
  const tiendaFiltroVal = filtroTienda ? filtroTienda.value : (stores.find(s=>s.active)?.name || 'todas');
  if (tiendaFiltroVal && tiendaFiltroVal !== 'todas')
    rows = rows.filter(r => r.tienda === tiendaFiltroVal);

  const desde = document.getElementById("fechaInicio") ? document.getElementById("fechaInicio").value : '';
  const hasta = document.getElementById("fechaFin") ? document.getElementById("fechaFin").value : '';
  if (desde) rows = rows.filter(r => normalizeFecha(r.fecha) >= normalizeFecha(desde));
  if (hasta) rows = rows.filter(r => normalizeFecha(r.fecha) <= normalizeFecha(hasta));

  // === NUEVO BLOQUE: filtro por días de semana ===
  const diasSeleccionados = Array.from(
    document.querySelectorAll("#filtro-dias-semana input[type='checkbox']:checked")
  ).map(cb => parseInt(cb.value));

  if (diasSeleccionados.length > 0) {
    rows = rows.filter(r => {
      const d = new Date(r.fecha + "T00:00:00");
      const dia = d.getDay(); // 0=Domingo ... 6=Sábado
      return diasSeleccionados.includes(dia);
    });
  }

  const turno = elFilterTurno ? elFilterTurno.value : 'ambos';
  if (turno && turno !== 'ambos')
    rows = rows.filter(r => (r.turno || '').toLowerCase() === turno.toLowerCase());

  const tipoPago = elFilterTipoPago ? elFilterTipoPago.value : 'ambos';
  if (tipoPago === 'efectivo')
    rows = rows.map(r => ({ ...r, tarjeta:0, total:+Number(r.efectivo).toFixed(2) }));
  if (tipoPago === 'tarjeta')
    rows = rows.map(r => ({ ...r, efectivo:0, total:+Number(r.tarjeta).toFixed(2) }));

  rows.forEach(r => r.fecha = normalizeFecha(r.fecha));
  rows.sort((a,b) => (a.fecha || '').localeCompare(b.fecha || ''));
  return rows;
}


    function groupByView(raw) {
      const vista = elFilterVista ? elFilterVista.value : 'dia';
      if (vista === 'dia') {
        const turnoFilter = elFilterTurno ? elFilterTurno.value : 'ambos';
        if (turnoFilter === 'ambos') {
          const map = {};
          raw.forEach(r => {
            const key = `${r.fecha}|${r.tienda}`;
            if (!map[key]) map[key] = { periodLabel: r.fecha, fecha: r.fecha, tienda: r.tienda, turno:'Ambos', efectivo:0, tarjeta:0, total:0 };
            map[key].efectivo += Number(r.efectivo || 0);
            map[key].tarjeta += Number(r.tarjeta || 0);
            map[key].total += Number(r.total || (Number(r.efectivo||0)+Number(r.tarjeta||0)));
          });
          return Object.values(map).map(v => ({ ...v, efectivo:+v.efectivo.toFixed(2), tarjeta:+v.tarjeta.toFixed(2), total:+v.total.toFixed(2) })).sort((a,b)=>a.fecha.localeCompare(b.fecha));
        }
        return raw.map(r => ({ ...r, efectivo:+Number(r.efectivo||0).toFixed(2), tarjeta:+Number(r.tarjeta||0).toFixed(2), total:+Number(r.total || (Number(r.efectivo||0)+Number(r.tarjeta||0))).toFixed(2) }));
      }

      const map = {};
      raw.forEach(r => {
        let key,label,keySort;
        if (vista === 'semana') {
          const d = new Date(r.fecha + 'T00:00:00');
          const day = d.getDay();
          const start = new Date(d); start.setDate(d.getDate() - day);
          const end = new Date(start); end.setDate(start.getDate() + 6);
          key = `${start.toISOString().slice(0,10)}_${end.toISOString().slice(0,10)}`;
          label = `${start.toISOString().slice(0,10)} - ${end.toISOString().slice(0,10)}`;
          keySort = start.toISOString().slice(0,10);
        } else {
          const d = new Date(r.fecha + 'T00:00:00');
          key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
          label = `${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
          keySort = key;
        }
        const mapKey = `${key}|${r.tienda}`;
        if (!map[mapKey]) map[mapKey] = { periodLabel: label, periodKey: keySort, tienda: r.tienda, efectivo:0, tarjeta:0, total:0, turno:'Ambos' };
        map[mapKey].efectivo += Number(r.efectivo || 0);
        map[mapKey].tarjeta += Number(r.tarjeta || 0);
        map[mapKey].total += Number(r.total || (Number(r.efectivo||0)+Number(r.tarjeta||0)));
      });
      let out = Object.values(map).map(m => ({ ...m, efectivo:+m.efectivo.toFixed(2), tarjeta:+m.tarjeta.toFixed(2), total:+m.total.toFixed(2) }));
      return out.sort((a,b) => (a.periodKey||'').localeCompare(b.periodKey||''));
    }

// --- Variables globales para ordenamiento ---
let currentSort = { column: null, direction: null };

function renderVentas() {
  if (!elTablaBody) { warn('tablaVentas tbody no encontrada'); return; }

  const desdeVal = document.getElementById("fechaInicio") ? (document.getElementById("fechaInicio").value || '') : '';
  const hastaVal = document.getElementById("fechaFin") ? (document.getElementById("fechaFin").value || '') : '';

  if (!desdeVal || !hastaVal) {
    if (detalleWrapper) detalleWrapper.style.display = 'none';
    elTablaBody.innerHTML = `<tr><td colspan="7" class="text-muted">Aplica un rango de fechas y pulsa "Aplicar filtros" para ver el detalle</td></tr>`;
    renderChart([]);
    return;
  }

  // Obtenemos los datos filtrados completos
  let raw = getFilteredRaw();
  let grouped = groupByView(raw);

  // === Aplicar ordenamiento global si existe ===
  if (currentSort.column && currentSort.direction) {
    const dir = currentSort.direction === "asc" ? 1 : -1;
    grouped.sort((a, b) => {
      const key = currentSort.column;
      const valA = parseFloat(a[key]) || 0;
      const valB = parseFloat(b[key]) || 0;
      return (valA - valB) * dir;
    });
  }

  // --- Paginación (después del ordenamiento) ---
  const totalPages = Math.max(1, Math.ceil(grouped.length / rowsPerPage));
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * rowsPerPage;
  const pageRows = grouped.slice(start, start + rowsPerPage);

  elTablaBody.innerHTML = '';

  if (!pageRows.length) {
    elTablaBody.innerHTML = `<tr><td colspan="7" class="text-muted">No hay datos para mostrar</td></tr>`;
  } else {
    const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    pageRows.forEach(r => {
      const tr = document.createElement('tr');
      const fecha = r.periodLabel || r.fecha;
      let diaSemana = '';
      try {
        const d = new Date(r.fecha + "T00:00:00");
        diaSemana = isNaN(d) ? "" : dias[d.getDay()];
      } catch { diaSemana = ""; }

      tr.innerHTML = `
        <td>${fecha}</td>
        <td>${diaSemana}</td>
        <td>${r.tienda}</td>
        <td>${r.turno || 'Ambos'}</td>
        <td class="text-right" data-col="efectivo">${fmtMX(r.efectivo)}</td>
        <td class="text-right" data-col="tarjeta">${fmtMX(r.tarjeta)}</td>
        <td class="text-right" data-col="total">${fmtMX(r.total)}</td>
      `;
      elTablaBody.appendChild(tr);
    });
  }

  if (elPageInfo) elPageInfo.textContent = `Página ${currentPage} / ${totalPages}`;
  if (elPrev) elPrev.disabled = currentPage <= 1;
  if (elNext) elNext.disabled = currentPage >= totalPages;
  if (detalleWrapper) detalleWrapper.style.display = '';
  renderChart(grouped);
}


// === ORDENAMIENTO GLOBAL POR COLUMNAS NUMÉRICAS ===
document.addEventListener("click", e => {
  const th = e.target.closest("#tablaVentas thead th");
  if (!th) return;

  const keyMap = { 4: "efectivo", 5: "tarjeta", 6: "total" };
  const index = Array.from(th.parentNode.children).indexOf(th);
  const key = keyMap[index];

  // Si hace clic fuera de columnas numéricas, reset sort
  if (!key) {
    currentSort = { column: null, direction: null };
    document.querySelectorAll("#tablaVentas th").forEach(th2 => {
      th2.classList.remove("asc", "desc");
      const icon = th2.querySelector(".sort-arrow");
      if (icon) icon.remove();
    });
    renderVentas(); // recarga original
    return;
  }

  // Alternar dirección
  if (currentSort.column === key) {
    currentSort.direction = currentSort.direction === "asc"
      ? "desc"
      : currentSort.direction === "desc"
        ? null
        : "asc";
  } else {
    currentSort = { column: key, direction: "asc" };
  }

  // Resetear clases visuales y quitar flechas de otros encabezados
  document.querySelectorAll("#tablaVentas th").forEach(th2 => {
    th2.classList.remove("asc", "desc");
    const icon = th2.querySelector(".sort-arrow");
    if (icon) icon.remove();
  });

  // Aplicar la flecha visual al encabezado actual
  if (currentSort.direction) {
    th.classList.add(currentSort.direction);

    const arrow = document.createElement("span");
    arrow.className = `sort-arrow ${currentSort.direction === "asc" ? "up" : "down"}`;
    th.appendChild(arrow);
  }

  // Re-render con el orden aplicado
  currentPage = 1;
  renderVentas();
});



    safeAdd(elPrev, 'click', () => { if (currentPage > 1) { currentPage--; renderVentas(); }});
    safeAdd(elNext, 'click', () => { currentPage++; renderVentas(); });

function updateFilterButtonsState() {
  // Leer de manera tolerante: preferir los elementos localizados con $id, si no existen usar getElementById
  const desdeEl = elFilterDesde || document.getElementById('fechaInicio');
  const hastaEl = elFilterHasta || document.getElementById('fechaFin');

  const desde = desdeEl ? (desdeEl.value || '') : '';
  const hasta = hastaEl ? (hastaEl.value || '') : '';

  const enabled = !!(desde && hasta);
  if (elBtnApply) try { elBtnApply.disabled = !enabled; } catch(e){}
  if (elBtnExport) try { elBtnExport.disabled = !enabled; } catch(e){}

  // Si no hay rango válido, ocultar detalle
  if (!desde || !hasta) {
    if (detalleWrapper) detalleWrapper.style.display = 'none';
  }
}

// === LIMPIAR FILTROS ===
const elBtnClear = document.getElementById("limpiarFiltros");
// Inhabilitar el botón desde el inicio
if (elBtnClear) elBtnClear.disabled = true;

function actualizarEstadoBotonLimpiar() {
  const desde = elFilterDesde?.value || document.getElementById('fechaInicio')?.value || "";
  const hasta = elFilterHasta?.value || document.getElementById('fechaFin')?.value || "";
  const tipo = elFilterTipoPago?.value || "ambos";
  const turno = elFilterTurno?.value || "ambos";
  const vista = elFilterVista?.value || "dia";

  const hayFiltros = !!((desde && hasta) || tipo !== "ambos" || turno !== "ambos" || vista !== "dia");
  if (elBtnClear) elBtnClear.disabled = !hayFiltros;
}

safeAdd(elBtnClear, "click", () => {
  const desdeEl = elFilterDesde || document.getElementById('fechaInicio');
  const hastaEl = elFilterHasta || document.getElementById('fechaFin');
  const tipoEl = elFilterTipoPago;
  const turnoEl = elFilterTurno;
  const vistaEl = elFilterVista;

  if (desdeEl) desdeEl.value = "";
  if (hastaEl) hastaEl.value = "";
  if (tipoEl) tipoEl.value = "ambos";
  if (turnoEl) turnoEl.value = "ambos";
  if (vistaEl) vistaEl.value = "dia";

  elTablaBody.innerHTML = `<tr><td colspan="7" class="text-muted">Filtros reiniciados</td></tr>`;
  if (detalleWrapper) detalleWrapper.style.display = "none";
  renderChart([]);

  const detalle = document.getElementById("detalleFiltrosActivos");
  if (detalle) detalle.textContent = "";

  updateFilterButtonsState();
  actualizarEstadoBotonLimpiar();
  showToast("Filtros limpiados", "info");
});

// Monitorear cambios para activar/desactivar botón automáticamente
["change", "input"].forEach(ev => {
  [elFilterDesde, elFilterHasta, elFilterTipoPago, elFilterTurno, elFilterVista].forEach(inp => {
    if (inp) safeAdd(inp, ev, actualizarEstadoBotonLimpiar);
  });
});


// === MOSTRAR DETALLE DE FILTROS ACTIVOS ===
function mostrarDetalleFiltros() {
  const detalle = document.getElementById("detalleFiltrosActivos");
  if (!detalle) return;

  const desde = elFilterDesde?.value || document.getElementById("fechaInicio")?.value || "";
  const hasta = elFilterHasta?.value || document.getElementById("fechaFin")?.value || "";
  const tipo = elFilterTipoPago?.value || "ambos";
  const turno = elFilterTurno?.value || "ambos";
  const vista = elFilterVista?.value || "dia";

  let partes = [];
  if (desde && hasta) partes.push(`📅 Rango: ${desde} → ${hasta}`);
  if (tipo !== "ambos") partes.push(`💳 Pago: ${tipo}`);
  if (turno !== "ambos") partes.push(`⏰ Turno: ${turno}`);
  if (vista !== "dia") partes.push(`📈 Vista: ${vista}`);

  detalle.textContent = partes.length ? partes.join(" | ") : "Sin filtros aplicados";
}

// === MOSTRAR DETALLE DE FILTROS POR AÑO ===
function llenarFiltroAnios(data) {
    const sel = document.getElementById("filtroAnio");
    const anios = new Set();

    data.forEach(v => {
        const f = parseFecha(v.fecha);
        if (!isNaN(f)) anios.add(f.getFullYear());
    });

    [...anios].sort().forEach(a => {
        const op = document.createElement("option");
        op.value = a;
        op.textContent = a;
        sel.appendChild(op);
    });
}

// FILTRO POR AÑO (NO DEPENDE DEL RANGO)
if (filtroAnio) {
    const anio = fecha.getFullYear();
    if (anio != filtroAnio) return false;
}


// Llamar esta función cada vez que se aplican filtros
safeAdd(elBtnApply, "click",  ()  =>  {
   currentPage  = 1;
    renderVentas();

   mostrarDetalleFiltros();
   showToast("Filtros  aplicados",  "success");

    // ===  RESUMEN  FINANCIERO  ===
   try  {
      const  vista  =  elFilterVista ?  elFilterVista.value  :  "dia";

       const  raw         = getFilteredRaw();
       const  grouped  = groupByView(raw);

       //  Guardamos lo  que  realmente  usamos para  el  resumen
       ultimaListaFiltrada =  grouped;

       if (vista  ===  "semana")  {
          const  filas =  calcularResumenFinancieroDesdeGrouped(grouped);
          renderResumenFinanciero(filas);
       }  else  {
          renderResumenFinanciero([]);
       }
   }  catch (e)  {
       console.error("Error  en resumen  financiero:",  e);
   }
});



/* === NUEVO BLOQUE: texto de días seleccionados === */
function actualizarDiasSeleccionadosTexto() {
  const labels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const diasSeleccionados = Array.from(
    document.querySelectorAll("#filtro-dias-semana input:checked")
  ).map(cb => labels[parseInt(cb.value)]);

  const texto = $id("diasSeleccionadosTexto");
  if (!texto) return;
  texto.textContent = diasSeleccionados.length
    ? `Filtrando por: ${diasSeleccionados.join(", ")}`
    : "Mostrando todos los días";
}

document.querySelectorAll("#filtro-dias-semana input").forEach(cb => {
  cb.addEventListener("change", () => {
    actualizarDiasSeleccionadosTexto();
    renderVentas(); // refresca resultados al marcar/desmarcar
  });
});

// Asegurarse de enlazar a los elementos por id en caso de que $id no los haya encontrado
safeAdd(elFilterDesde || document.getElementById('fechaInicio'), 'change', updateFilterButtonsState);
safeAdd(elFilterHasta || document.getElementById('fechaFin'), 'change', updateFilterButtonsState);

// Llamada inicial
updateFilterButtonsState();

    //safeAdd(elBtnApply, 'click', () => { currentPage = 1; renderVentas(); showToast('Filtros aplicados', 'success'); });

    if (elBtnExport) safeAdd(elBtnExport, 'click', () => {
      const raw = getFilteredRaw();
      const grouped = groupByView(raw);
      if (!grouped.length) { alert('No hay datos para exportar'); return; }
      const rows = [['Periodo','Tienda','Turno','Efectivo','Tarjeta','Total']];
      grouped.forEach(r => rows.push([r.periodLabel || r.fecha, r.tienda, r.turno || 'Ambos', r.efectivo, r.tarjeta, r.total]));
      const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `ventas_filtradas_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      showToast('Exportación lista', 'success');
    });

    // --------- Chart ----------
    function renderChart(rows) {
      if (!elCanvas) return;
      const ctx = elCanvas.getContext('2d');
      if (chartInstance) try { chartInstance.destroy(); } catch(e){}
      const agg = {};
      rows.forEach(r => { const key = r.periodLabel || r.fecha; agg[key] = (agg[key] || 0) + Number(r.total || (Number(r.efectivo||0)+Number(r.tarjeta||0))); });
      const labels = Object.keys(agg);
      const data = labels.map(k => agg[k]);
      if (typeof Chart !== 'undefined') {
        chartInstance = new Chart(ctx, {
          type: 'line',
          data: { labels, datasets: [{ label:'Ventas totales', data, borderColor:'#2563eb', backgroundColor:'rgba(37,99,235,0.12)', fill:true, tension:0.25 }]},
          options: { responsive:true, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true, ticks:{ callback: v => fmtMX(v) } } } }
        });
      } else {
        ctx.clearRect(0,0,elCanvas.width, elCanvas.height);
        ctx.fillStyle = '#9CA3AF'; ctx.fillText('Chart.js no disponible', 10, 20);
      }
    }

    // --------- Logo ----------
    if (logoImg && logoInput) {
      try { const saved = localStorage.getItem(KEY_LOGO); if (saved) logoImg.src = saved; } catch(e){}
      logoImg.style.cursor = 'pointer';
      safeAdd(logoImg, 'click', () => { if (logoInput) logoInput.click(); });
      safeAdd(logoInput, 'change', () => {
        const f = logoInput.files && logoInput.files[0]; if (!f) return;
        const r = new FileReader();
        r.onload = (e) => { try { logoImg.src = e.target.result; localStorage.setItem(KEY_LOGO, e.target.result); showToast('Logo guardado', 'success'); } catch(e){} };
        r.readAsDataURL(f);
      });
    } else {
      try { const saved = localStorage.getItem(KEY_LOGO); if (saved) document.querySelectorAll('img').forEach(img => { if ((img.alt||'').toLowerCase().includes('logo')) img.src = saved; }); } catch(e){}
    }

safeAdd($id('fin_recalcular'), 'click',  ()  =>  {
   if  (!ultimaListaFiltrada ||  ultimaListaFiltrada.length  ===  0) return;
    const filas  =  calcularResumenFinancieroDesdeGrouped(ultimaListaFiltrada);
   renderResumenFinanciero(filas);
});


safeAdd($id('fin-prev'),  'click',  ()  =>  {
    if  (finPage  >  1)  {
        finPage--;
        renderResumenFinanciero(finData);
    }
});

safeAdd($id('fin-next'),  'click',  ()  =>  {
    const  totalPages  =  Math.ceil(finData.length  /  finRowsPerPage);
    if  (finPage  <  totalPages)  {
        finPage++;
        renderResumenFinanciero(finData);
    }
});

//Funcion para obtener las ventas de la semana actual
function  getVentasSemanaActual()  {
   const  hoy =  new  Date();
   const  inicio  = getStartOfWeek(hoy);
    const fin  =  getEndOfWeek(hoy);

   return  sales.filter(v =>  {
       const  f =  parseFecha(v.fecha);
       return  f >=  inicio  &&  f <=  fin;
   });
}

function getStartOfWeek(date)  {
   const  d  =  new Date(date);
    const day  =  d.getDay();
   const  diff  = d.getDate()  -  day  + (day  ===  0  ? -6  :  1);  // lunes  como  inicio
   return  new  Date(d.setDate(diff));
}

function  getEndOfWeek(date)  {
   const  start  = getStartOfWeek(date);
    return new  Date(start.getFullYear(),  start.getMonth(),  start.getDate() +  6);
}


//Funcion para renderizar modulo KPI Dashboard
function renderKPIs()  {
   const  raw  =  sales;
   const  grouped =  groupByView(raw);

   const  hoy  = new  Date();
   const  mesActual  =  hoy.getMonth() +  1;
   const  añoActual  =  hoy.getFullYear();

    const ventasMes  =  raw
       .filter(v =>  new  Date(v.fecha).getMonth()  + 1  ===  mesActual)
       .reduce((acc, v)  =>  acc  + Number(v.total  ||  v.efectivo  + v.tarjeta),  0);

   const semanaActual  =  getISOWeek(new  Date());
const  ventasSemana  =  getVentasSemanaActual()
   .reduce((acc,  v)  =>  acc  +  Number(v.total  || v.efectivo  +  v.tarjeta),  0);

   const  metaSemanal  =  35000;
   const  metaMensual =  120000;

   const  diasMes  = new  Date(añoActual,  mesActual,  0).getDate();
   const  diaActual =  hoy.getDate();
   const  proyeccion  =  (ventasMes /  diaActual)  *  diasMes;

    $id("kpi-meta-semanal").textContent =  fmtMX(metaSemanal);
   $id("kpi-ventas-semana").textContent  =  fmtMX(ventasSemana);
   $id("kpi-meta-mensual").textContent  =  fmtMX(metaMensual);
   $id("kpi-ventas-mes").textContent  = fmtMX(ventasMes);
    $id("kpi-proyeccion").textContent =  fmtMX(proyeccion);
   $id("kpi-avance").textContent  =  ((ventasMes  / metaMensual)  *  100).toFixed(1)  + "%";
}

 function  parseFecha(fechaStr)  {
    const  [y, m,  d]  =  fechaStr.split("-");
    return  new Date(Number(y),  Number(m)  -  1, Number(d));
 }
 
 function getISOWeek(date)  {
    if  (!(date  instanceof  Date) ||  isNaN(date))  return  null;
    const  d =  new  Date(Date.UTC(date.getFullYear(),  date.getMonth(), date.getDate()));
     const dayNum  =  d.getUTCDay()  || 7;
     d.setUTCDate(d.getUTCDate() +  4  -  dayNum);
    const  yearStart =  new  Date(Date.UTC(d.getUTCFullYear(),  0, 1));
     const weekNo  =  Math.ceil((((d  - yearStart)  /  86400000)  + 1)  /  7);
    return  `${d.getUTCFullYear()}-W${String(weekNo).padStart(2,  '0')}`;
}

 function  groupBySemana(data)  {
    const  grupos =  {};
 
    data.forEach(v  =>  {
       const  fecha  =  parseFecha(v.fecha);
       if  (isNaN(fecha))  return;
 
       const  day  =  fecha.getDay(); //  0  =  domingo
       const  start  =  new Date(fecha);
        start.setDate(fecha.getDate()  -  day); //  inicio  de  semana (domingo)
        const  end  = new  Date(start);
        end.setDate(start.getDate()  + 6);  //  fin  de semana  (sábado)
 
        const key  =  `${start.toISOString().slice(0,10)}_${end.toISOString().slice(0,10)}`;
        const label  =  `${start.toISOString().slice(0,10)}  - ${end.toISOString().slice(0,10)}`;
 
        if  (!grupos[key]) {
            grupos[key] =  {  semana:  label, total:  0  };
        }

        const  total  = Number(v.total  ||  v.efectivo  + v.tarjeta  ||  0);
        grupos[key].total +=  total;
    });
 
    return  Object.values(grupos).sort((a,b)  =>  a.semana.localeCompare(b.semana));
}

function  groupByMes(data)  {
   const  grupos  = {};

   data.forEach(v  =>  {
       const fecha  =  parseFecha(v.fecha);
       if (isNaN(fecha))  return;

       const key  =  `${fecha.getFullYear()}-${String(fecha.getMonth()  + 1).padStart(2,  '0')}`;
       const  label =  `${String(fecha.getMonth()  +  1).padStart(2, '0')}/${fecha.getFullYear()}`;

       if  (!grupos[key]) {
           grupos[key] =  {  mes:  label, total:  0  };
       }

       const  total  = Number(v.total  ||  v.efectivo  + v.tarjeta  ||  0);
       grupos[key].total +=  total;
   });

   return  Object.values(grupos).sort((a,b)  =>  a.mes.localeCompare(b.mes));
}

function  normalizarTurno(turno)  {
   if  (!turno)  return  "Sin  turno";
    const  t  =  turno.toLowerCase();
    if  (t.includes("mat"))  return  "Matutino";
   if  (t.includes("ves"))  return  "Vespertino";
    return  turno.charAt(0).toUpperCase()  +  turno.slice(1);
}

function  getDiaSemana(fechaStr)  {
    const  fecha  = parseFecha(fechaStr);
    const  dias  =  ["Dom",  "Lun",  "Mar",  "Mié",  "Jue",  "Vie",  "Sáb"];
    return  dias[fecha.getDay()];
}


function  ordenar(obj)  {
   return  Object.entries(obj)
      .map(([nombre,  total])  =>  ({ nombre,  total  }))
       .sort((a,b) =>  b.total  -  a.total);
}


//Funcion para modulo de alertas inteligentes
function renderAlertas()  {
   const  raw  =  sales;
   const  grouped =  groupByView(raw);

   const  alertas  = [];
    const ventasSemana  =  grouped.reduce((acc,g)=>acc+g.total,0);

   if  (ventasSemana <  30000)
       alertas.push("⚠️  Las ventas  de  esta  semana están  por  debajo  del promedio.");

   const  hoy  =  new Date();
    if (hoy.getDate()  >  25)  {
      const  ventasMes  =  raw.reduce((acc,v)=>acc+(v.total||v.efectivo+v.tarjeta),0);
      if  (ventasMes  <  100000)
          alertas.push("⚠️  Estás por  debajo  de  la meta  mensual.");
   }

   const  ul  =  $id("alertas-list");
   ul.innerHTML  = alertas.length
       ?  alertas.map(a=>`<li>${a}</li>`).join("")
       : "<li>Sin  alertas</li>";
}

    renderKPIs();	
    renderAlertas();
    llenarFiltroAnios(ventas);

    // --------- Init ----------
    try { renderStores(); } catch(e){ console.error('renderStores error', e); }
    try { renderVentas(); } catch(e){ console.error('renderVentas error', e); }
    saveStores(); saveSales(); saveActive();
    window._GF = { stores, sales, renderVentas, renderStores, normalizeFecha };
    console.info('Gestor inicializado. Stores:', stores.length, 'Sales:', sales.length);
  }); // DOMContentLoaded
})(); // IIFE end
