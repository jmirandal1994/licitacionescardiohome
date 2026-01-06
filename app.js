const SB_URL = "https://ybwtjxgvicebwmyhkhda.supabase.co";
const SB_KEY = "sb_publishable_Ae-JOXtX_fLpFTMgne_4Sw_jiGrdCMp";
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

let currentPath = "ordenes";
let licitacionesCache = [];
let currentLicitacion = null;

// INICIO Y SEGURIDAD
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.replace('login.html'); return; }
    document.body.style.opacity = "1";
    fetchLicitaciones();
    lucide.createIcons();
});

// NAVEGACIÓN ENTRE VISTAS
function switchView(view) {
    document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    
    const staffNav = document.getElementById('staff-folders');

    if (view === 'dashboard') {
        document.getElementById('view-dashboard').classList.add('active');
        document.getElementById('nav-dashboard').classList.add('active');
        document.getElementById('view-title').innerText = "Dashboard";
        fetchLicitaciones();
    } else if (view === 'ia') {
        document.getElementById('view-ia').classList.add('active');
        document.getElementById('nav-ia').classList.add('active');
        document.getElementById('view-title').innerText = "IA Analizador";
    } else {
        document.getElementById('view-files').classList.add('active');
        document.getElementById(`nav-${view}`).classList.add('active');
        currentPath = view;
        document.getElementById('view-title').innerText = view.toUpperCase();
        staffNav.classList.toggle('hidden', view !== 'staff');
        if (view === 'staff') currentPath = "staff/neurologia";
        loadFiles();
    }
    lucide.createIcons();
}

function changeFolder(path) { currentPath = path; loadFiles(); }

// GESTIÓN DE LICITACIONES Y ESTATUS PREMIUM
async function fetchLicitaciones() {
    const { data } = await supabaseClient.from('licitaciones').select('*').order('created_at', { ascending: false });
    licitacionesCache = data || [];
    const body = document.getElementById('tender-table-body');
    body.innerHTML = '';
    let totalAdj = 0;

    licitacionesCache.forEach(t => {
        if(t.status === 'Adjudicada') totalAdj += Number(t.monto_adjudicado);
        
        let statusStyle = "bg-slate-100 text-slate-500";
        if (t.status === 'Adjudicada') statusStyle = "bg-green-500 text-white shadow-lg shadow-green-200 border-green-600";
        if (t.status === 'No Adjudicada') statusStyle = "bg-red-600 text-white shadow-lg shadow-red-200 border-red-700";
        if (t.status === 'Pendiente') statusStyle = "bg-orange-400 text-white shadow-lg shadow-orange-100 border-orange-500";
        if (t.status === 'Espera de Resolución') statusStyle = "bg-blue-600 text-white shadow-lg shadow-blue-100 border-blue-700";

        const row = document.createElement('tr');
        row.className = "hover:bg-slate-50 transition border-b border-slate-100";
        row.innerHTML = `
            <td class="px-10 py-7">
                <p class="font-black text-slate-900 text-base tracking-tighter">${t.nombre_licitacion}</p>
                <span class="text-[9px] text-slate-400 font-black uppercase tracking-widest">${t.codigo_id}</span>
            </td>
            <td class="px-10 py-7 text-[10px] font-black text-slate-400 uppercase tracking-widest">${t.evaluacion}</td>
            <td class="px-10 py-7 font-black text-slate-800 text-lg tracking-tighter">$${Number(t.monto_adjudicado).toLocaleString('es-CL')}</td>
            <td class="px-10 py-7">
                <select onchange="updateStatus('${t.id}', this.value)" class="status-select-premium ${statusStyle}">
                    <option value="Pendiente" ${t.status === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                    <option value="Espera de Resolución" ${t.status === 'Espera de Resolución' ? 'selected' : ''}>En Espera</option>
                    <option value="Adjudicada" ${t.status === 'Adjudicada' ? 'selected' : ''}>Adjudicada ✅</option>
                    <option value="No Adjudicada" ${t.status === 'No Adjudicada' ? 'selected' : ''}>No Adjudicada ❌</option>
                </select>
            </td>
            <td class="px-10 py-7 text-center">
                <button onclick="openSimulador('${t.id}')" class="p-4 bg-[#020617] text-white rounded-2xl hover:scale-110 active:scale-95 transition-all shadow-xl shadow-slate-200">
                    <i data-lucide="calculator" class="w-5 h-5"></i>
                </button>
            </td>
        `;
        body.appendChild(row);
    });
    document.getElementById('kpi-monto').innerText = `$${totalAdj.toLocaleString('es-CL')}`;
    document.getElementById('kpi-count').innerText = licitacionesCache.length;
    lucide.createIcons();
}

async function updateStatus(id, newStatus) {
    await supabaseClient.from('licitaciones').update({ status: newStatus }).eq('id', id);
    fetchLicitaciones();
}

// STORAGE CON TÍTULO VISUAL ARRIBA
function triggerUpload() {
    if (!document.getElementById('file-title').value) return alert("Ingresa un nombre para el documento.");
    document.getElementById('file-input').click();
}

async function uploadFile() {
    const file = document.getElementById('file-input').files[0];
    const userTitle = document.getElementById('file-title').value;
    // El nombre del archivo en Supabase llevará el título del usuario
    const cleanTitle = userTitle.replace(/[^a-z0-9]/gi, '_').toUpperCase();
    const finalName = `${cleanTitle}__${Date.now()}__.pdf`;

    const { error } = await supabaseClient.storage.from('documentos').upload(`${currentPath}/${finalName}`, file);
    if (!error) { document.getElementById('file-title').value = ''; loadFiles(); }
}

async function loadFiles() {
    const grid = document.getElementById('file-grid');
    grid.innerHTML = '<p class="col-span-3 text-center py-24 text-slate-400 font-black text-xs animate-pulse tracking-[0.5em]">SYNCING REPOSITORY...</p>';
    const { data } = await supabaseClient.storage.from('documentos').list(currentPath);
    grid.innerHTML = '';
    data.forEach(f => {
        // Extraemos el título del nombre del archivo
        const displayTitle = f.name.split('__')[0].replace(/_/g, ' ');
        grid.innerHTML += `
            <div class="bg-white p-10 rounded-[3rem] border border-slate-200 flex flex-col justify-between shadow-sm hover:border-red-500 transition-all group relative overflow-hidden">
                <div class="absolute -right-4 -top-4 w-20 h-20 bg-red-50 text-red-100 rounded-full flex items-center justify-center group-hover:bg-red-500 group-hover:text-white transition-all"><i data-lucide="file-text" class="w-10 h-10"></i></div>
                <div>
                    <p class="text-xs font-black text-red-600 uppercase tracking-widest mb-2 italic">Título del Archivo</p>
                    <h5 class="text-xl font-black text-slate-900 leading-tight mb-8">${displayTitle}</h5>
                </div>
                <div class="flex items-center justify-between border-t border-slate-50 pt-6">
                    <span class="text-[9px] font-black text-slate-300 uppercase">PDF Oficial</span>
                    <button onclick="downloadFile('${f.name}')" class="bg-slate-900 text-white px-6 py-2 rounded-xl text-[10px] font-black hover:bg-red-600 transition">DESCARGAR</button>
                </div>
            </div>`;
    });
    lucide.createIcons();
}

async function downloadFile(name) {
    const { data } = await supabaseClient.storage.from('documentos').download(`${currentPath}/${name}`);
    const a = document.createElement('a'); a.href = URL.createObjectURL(data); a.download = name; a.click();
}

// IA NIVEL MÁXIMO: INFORME Y ANÁLISIS
async function analyzePDF() {
    const file = document.getElementById('ia-file').files[0];
    if(!file) return;
    document.getElementById('ia-loading').classList.remove('hidden');
    document.getElementById('ia-result').classList.add('hidden');

    const reader = new FileReader();
    reader.onload = async function() {
        const typedarray = new Uint8Array(this.result);
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        let fullText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            fullText += content.items.map(item => item.str).join(" ");
        }
        const raw = fullText.toLowerCase();

        // GENERACIÓN DE INFORME ESTRATÉGICO
        let reportHTML = "";
        
        // 1. Análisis de Modalidad
        if (raw.includes("licitacion publica")) {
            reportHTML += `<div class="p-6 bg-blue-50 border-l-8 border-blue-600 rounded-2xl mb-4">🚨 <strong>Diagnóstico de Modalidad:</strong> Este es un proceso de <u>Licitación Pública</u>. El mercado está abierto y CardioHome SpA debe competir fuertemente en el factor precio/experiencia.</div>`;
        } else {
            reportHTML += `<div class="p-6 bg-amber-50 border-l-8 border-amber-600 rounded-2xl mb-4">⚠️ <strong>Diagnóstico de Modalidad:</strong> Se detecta modalidad de <u>Trato Directo o Compra Menor</u>. La agilidad en la entrega de la cotización es la clave aquí.</div>`;
        }

        // 2. Alertas de Riesgo
        if (raw.includes("multa") || raw.includes("sancion")) {
            reportHTML += `<p>❌ <strong>Riesgo Contractual Detallado:</strong> Se identifican cláusulas punitivas por retrasos. Las multas pueden llegar al 5% por cada día de mora. <strong>Acción Sugerida:</strong> Validar que el staff médico tenga disponibilidad de reemplazo inmediata.</p>`;
        }

        // 3. Análisis de Staff
        if (raw.includes("neurolog")) {
            reportHTML += `<p>🩺 <strong>Requerimiento Específico:</strong> El solicitante exige la especialidad de <u>Neurología</u>. Se recomienda adjuntar los certificados de la Superintendencia de Salud de todo el staff asignado en la oferta técnica.</p>`;
        } else if (raw.includes("pediatra")) {
            reportHTML += `<p>👶 <strong>Requerimiento Específico:</strong> El proceso está centrado en <u>Pediatría</u>. Asegurar que los CVs resalten la experiencia clínica en centros públicos.</p>`;
        }

        // 4. Estrategia Económica
        reportHTML += `<p>💎 <strong>Factor Crítico de Éxito:</strong> Se ha detectado un énfasis en el <u>Criterio Económico</u>. El bot recomienda no ofertar por debajo del 20% de margen para no comprometer la logística y viáticos de los médicos.</p>`;

        document.getElementById('ia-detailed-report').innerHTML = reportHTML;

        // CHECKLIST RÁPIDO
        const mapIA = (id, patterns) => {
            const container = document.getElementById(id);
            const results = patterns.filter(p => p.words.some(w => raw.includes(w)));
            container.innerHTML = results.length ? results.map(p => `<div class="p-4 bg-white border border-slate-100 rounded-2xl flex items-center justify-between font-black text-[10px] uppercase shadow-sm"><span>${p.name}</span><i data-lucide="check-circle-2" class="text-green-500 w-4 h-4"></i></div>`).join('') : '<span class="text-slate-300 italic text-xs">No se detectaron requerimientos en esta categoría.</span>';
        }

        mapIA('ia-anexos', [
            {name:"Boleta Seriedad de Oferta", words:["boleta","garantia","seriedad"]},
            {name:"Anexo Administrativo 1", words:["anexo 1", "identificacion"]},
            {name:"Certificado de Especialidad", words:["especialidad", "titulo", "superintendencia"]},
            {name:"Seguro Accidentes Ley 16.744", words:["seguro", "accidentes", "ley 16"]}
        ]);

        mapIA('ia-profesionales', [
            {name:"Neurólogo Titulado", words:["neurologo","neurologia"]},
            {name:"Pediatra Titulado", words:["pediatra","pediatria"]},
            {name:"Médico de Familia", words:["familiar","familia"]}
        ]);

        document.getElementById('ia-loading').classList.add('hidden');
        document.getElementById('ia-result').classList.remove('hidden');
        lucide.createIcons();
    };
    reader.readAsArrayBuffer(file);
}

// SIMULADOR MEJORADO
function openSimulador(id) {
    currentLicitacion = licitacionesCache.find(l => l.id === id);
    document.getElementById('sim-nombre').innerText = currentLicitacion.nombre_licitacion;
    document.getElementById('modal-simulador').classList.remove('hidden');
    calculate();
}

function calculate() {
    const gastos = (Number(document.getElementById('gasto-medico').value) || 0) + (Number(document.getElementById('gasto-logistica').value) || 0) + (Number(document.getElementById('gasto-otros').value) || 0);
    const utilidad = currentLicitacion.monto_adjudicado - gastos;
    const perc = Math.round((utilidad / currentLicitacion.monto_adjudicado) * 100);
    
    document.getElementById('sim-resultado').innerText = `$${utilidad.toLocaleString('es-CL')}`;
    document.getElementById('sim-percent').innerText = `${perc}% DE MARGEN OPERACIONAL`;
    
    const bar = document.getElementById('sim-bar');
    bar.style.width = `${Math.max(0, Math.min(perc, 100))}%`;
}

function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function logout() { supabaseClient.auth.signOut().then(() => window.location.replace('login.html')); }

document.getElementById('tender-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nueva = {
        nombre_licitacion: document.getElementById('t-nombre').value,
        codigo_id: document.getElementById('t-id').value,
        monto_adjudicado: Number(document.getElementById('t-monto').value),
        evaluacion: document.getElementById('t-eval').value,
        status: 'Pendiente'
    };
    await supabaseClient.from('licitaciones').insert([nueva]);
    closeModal('modal-licitacion'); fetchLicitaciones(); document.getElementById('tender-form').reset();
});
