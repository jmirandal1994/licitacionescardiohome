// 1. CONFIGURACIÓN SUPABASE
const SB_URL = "https://ybwtjxgvicebwmyhkhda.supabase.co";
const SB_KEY = "sb_publishable_Ae-JOXtX_fLpFTMgne_4Sw_jiGrdCMp";
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

let currentPath = "ordenes";
let licitacionesCache = [];
let currentLicitacion = null;

// 2. INICIO Y SEGURIDAD
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.replace('login.html');
        return;
    }
    document.body.style.opacity = "1";
    fetchLicitaciones();
    lucide.createIcons();
});

// 3. NAVEGACIÓN ENTRE VISTAS
function switchView(view) {
    document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    
    const title = document.getElementById('view-title');
    const staffNav = document.getElementById('staff-folders');

    if (view === 'dashboard') {
        document.getElementById('view-dashboard').classList.add('active');
        document.getElementById('nav-dashboard').classList.add('active');
        title.innerText = "Dashboard General";
        fetchLicitaciones();
    } else if (view === 'ia') {
        document.getElementById('view-ia').classList.add('active');
        document.getElementById('nav-ia').classList.add('active');
        title.innerText = "Consultor IA CardioHome";
    } else {
        document.getElementById('view-files').classList.add('active');
        document.getElementById(`nav-${view}`).classList.add('active');
        currentPath = view;
        title.innerText = "Repositorio: " + view.toUpperCase();
        
        staffNav.classList.toggle('hidden', view !== 'staff');
        if (view === 'staff') currentPath = "staff/neurologia";
        loadFiles();
    }
    lucide.createIcons();
}

function changeFolder(path) {
    currentPath = path;
    loadFiles();
}

// 4. GESTIÓN DE LICITACIONES Y CAMBIO DE ESTATUS MANUAL
async function fetchLicitaciones() {
    const { data, error } = await supabaseClient.from('licitaciones').select('*').order('created_at', { ascending: false });
    if (error) return;

    licitacionesCache = data;
    const body = document.getElementById('tender-table-body');
    body.innerHTML = '';
    let totalAdj = 0;

    data.forEach(t => {
        if(t.status === 'Adjudicada') totalAdj += Number(t.monto_adjudicado);
        
        const row = document.createElement('tr');
        row.className = "hover:bg-slate-50 transition";
        row.innerHTML = `
            <td class="px-8 py-6 font-bold text-slate-800">${t.nombre_licitacion}<br><span class="text-[10px] text-slate-400 font-mono">${t.codigo_id}</span></td>
            <td class="px-8 py-6 text-[10px] font-bold text-slate-500 uppercase">${t.evaluacion}</td>
            <td class="px-8 py-6 font-black">$${Number(t.monto_adjudicado).toLocaleString('es-CL')}</td>
            <td class="px-8 py-6">
                <select onchange="updateStatus('${t.id}', this.value)" class="status-select p-2 rounded-lg border border-slate-200 text-[10px] uppercase font-black ${getStatusColor(t.status)}">
                    <option value="Pendiente" ${t.status === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                    <option value="Espera de Resolución" ${t.status === 'Espera de Resolución' ? 'selected' : ''}>En Espera</option>
                    <option value="Adjudicada" ${t.status === 'Adjudicada' ? 'selected' : ''}>Adjudicada ✅</option>
                    <option value="No Adjudicada" ${t.status === 'No Adjudicada' ? 'selected' : ''}>No Adjudicada ❌</option>
                    <option value="No se postula" ${t.status === 'No se postula' ? 'selected' : ''}>No se postula</option>
                </select>
            </td>
            <td class="px-8 py-6 text-center">
                <button onclick="openSimulador('${t.id}')" class="p-3 bg-slate-100 rounded-xl hover:bg-black hover:text-white transition"><i data-lucide="calculator" class="w-4 h-4"></i></button>
            </td>
        `;
        body.appendChild(row);
    });
    document.getElementById('kpi-monto').innerText = `$${totalAdj.toLocaleString('es-CL')}`;
    document.getElementById('kpi-count').innerText = data.length;
    lucide.createIcons();
}

async function updateStatus(id, newStatus) {
    const { error } = await supabaseClient.from('licitaciones').update({ status: newStatus }).eq('id', id);
    if (!error) fetchLicitaciones();
    else alert("Error al actualizar estatus");
}

function getStatusColor(status) {
    if (status === 'Adjudicada') return 'bg-green-100 text-green-700';
    if (status === 'No Adjudicada') return 'bg-red-100 text-red-700';
    if (status === 'Pendiente') return 'bg-orange-100 text-orange-700';
    return 'bg-slate-100 text-slate-500';
}

// 5. STORAGE CON TÍTULO PERSONALIZADO
async function loadFiles() {
    const grid = document.getElementById('file-grid');
    grid.innerHTML = '<p class="col-span-3 text-center py-20 text-slate-400 font-bold uppercase text-[10px]">Sincronizando Repositorio...</p>';
    const { data, error } = await supabaseClient.storage.from('documentos').list(currentPath);
    if (error) return;
    
    grid.innerHTML = '';
    data.forEach(f => {
        grid.innerHTML += `
            <div class="bg-white p-6 rounded-3xl border border-slate-200 flex justify-between items-center group hover:border-red-500 transition shadow-sm">
                <div class="flex items-center gap-3">
                    <i data-lucide="file-text" class="text-red-600"></i>
                    <p class="text-[11px] font-bold text-slate-700 truncate w-40 uppercase tracking-tighter">${f.name}</p>
                </div>
                <button onclick="downloadFile('${f.name}')" class="text-slate-300 hover:text-indigo-600 transition"><i data-lucide="download"></i></button>
            </div>`;
    });
    lucide.createIcons();
}

function triggerUpload() {
    const title = document.getElementById('file-title').value;
    if (!title) { alert("Por favor, ingresa un título para el documento antes de subirlo."); return; }
    document.getElementById('file-input').click();
}

async function uploadFile() {
    const fileInput = document.getElementById('file-input');
    const fileTitle = document.getElementById('file-title').value;
    const file = fileInput.files[0];
    if(!file) return;

    // Usar el título del input para el nombre del archivo
    const cleanTitle = fileTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const fileName = `${cleanTitle}.pdf`;
    const path = `${currentPath}/${fileName}`;

    const { error } = await supabaseClient.storage.from('documentos').upload(path, file);
    if (!error) {
        document.getElementById('file-title').value = '';
        loadFiles();
    } else {
        alert("Error: El archivo ya existe o hubo un problema en la subida.");
    }
}

async function downloadFile(name) {
    const { data } = await supabaseClient.storage.from('documentos').download(`${currentPath}/${name}`);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(data); a.download = name; a.click();
}

// 6. SIMULADOR FINANCIERO PRO
function openSimulador(id) {
    currentLicitacion = licitacionesCache.find(l => l.id === id);
    document.getElementById('sim-nombre').innerText = currentLicitacion.nombre_licitacion;
    document.getElementById('modal-simulador').classList.remove('hidden');
    calculate();
}

function calculate() {
    const g1 = Number(document.getElementById('gasto-medico').value) || 0;
    const g2 = Number(document.getElementById('gasto-logistica').value) || 0;
    const g3 = Number(document.getElementById('gasto-otros').value) || 0;

    const utilidad = currentLicitacion.monto_adjudicado - (g1 + g2 + g3);
    const perc = (utilidad / currentLicitacion.monto_adjudicado) * 100;

    document.getElementById('sim-resultado').innerText = `$${utilidad.toLocaleString('es-CL')}`;
    const bar = document.getElementById('sim-bar');
    bar.style.width = `${Math.max(0, Math.min(perc, 100))}%`;
    bar.className = perc < 20 ? 'bg-red-500 h-full' : 'bg-green-500 h-full';
}

// 7. ANALIZADOR IA (Informe Estratégico)
async function analyzePDF() {
    const file = document.getElementById('ia-file').files[0];
    if(!file) return;
    document.getElementById('ia-loading').classList.remove('hidden');
    document.getElementById('ia-result').classList.add('hidden');

    const reader = new FileReader();
    reader.onload = async function() {
        const typedarray = new Uint8Array(this.result);
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        let text = "";
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map(item => item.str).join(" ");
        }
        const raw = text.toLowerCase();

        // Lógica de detección de patrones
        const find = (keywords) => keywords.filter(k => k.p.some(p => raw.includes(p)));

        renderIA('ia-anexos', find([{n:"Boleta Seriedad", p:["garantia","seriedad"]}, {n:"Anexo Administrativo", p:["anexo 1", "identificacion"]}, {n:"Declaración Jurada", p:["jurada","inhabilidades"]}]));
        renderIA('ia-economico', find([{n:"Presupuesto Máximo", p:["presupuesto","disponible","$","clp"]}, {n:"Licitación por Líneas", p:["linea 1","item"]}]));
        renderIA('ia-evaluacion', find([{n:"Precio (Puntaje Máx)", p:["precio","economico"]}, {name:"Experiencia", p:["experiencia","años"]}]));
        renderIA('ia-profesionales', find([{n:"Neurólogo", p:["neurologo"]}, {n:"Pediatra", p:["pediatra"]}, {n:"Médico Familiar", p:["familiar"]}]));

        document.getElementById('ia-loading').classList.add('hidden');
        document.getElementById('ia-result').classList.remove('hidden');
        lucide.createIcons();
    };
    reader.readAsArrayBuffer(file);
}

function renderIA(id, data) {
    const container = document.getElementById(id);
    container.innerHTML = data.length ? data.map(d => `<div class="p-3 bg-white border rounded-xl flex justify-between font-bold text-[10px] uppercase"><span>${d.n || d.name}</span><i data-lucide="check-circle" class="text-green-500 w-3 h-3"></i></div>`).join('') : '<p class="text-slate-300 text-[10px]">No detectado.</p>';
}

// GENERAL
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
    const { error } = await supabaseClient.from('licitaciones').insert([nueva]);
    if (!error) { closeModal('modal-licitacion'); fetchLicitaciones(); document.getElementById('tender-form').reset(); }
});
