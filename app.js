// CONFIGURACIÓN SUPABASE
const SB_URL = "https://ybwtjxgvicebwmyhkhda.supabase.co";
const SB_KEY = "sb_publishable_Ae-JOXtX_fLpFTMgne_4Sw_jiGrdCMp";
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

let currentPath = "ordenes";
let licitaciones = [];

// INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.href = 'login.html'; return; }
    fetchLicitaciones();
    lucide.createIcons();
});

// NAVEGACIÓN
function switchView(view) {
    document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar-link').forEach(n => n.classList.remove('active'));
    const staffNav = document.getElementById('staff-sub-folders');
    
    document.getElementById(`view-${view === 'ia' ? 'ia' : (view === 'dashboard' ? 'dashboard' : 'files')}`).classList.add('active');
    document.getElementById(`nav-${view}`).classList.add('active');
    
    staffNav.classList.toggle('hidden', view !== 'staff');
    if (view === 'staff') changeFolder('staff/neurologia');
    else if (view === 'dashboard') fetchLicitaciones();
    else { currentPath = view; loadFiles(); }
    
    document.getElementById('view-title').innerText = view.toUpperCase();
    lucide.createIcons();
}

function changeFolder(path) { currentPath = path; loadFiles(); }

// GESTIÓN DE LICITACIONES
async function fetchLicitaciones() {
    const { data, error } = await supabaseClient.from('licitaciones').select('*').order('created_at', { ascending: false });
    if (error) return;
    licitaciones = data;
    const body = document.getElementById('tender-table-body');
    body.innerHTML = '';
    let totalAdj = 0;
    data.forEach(t => {
        if(t.status === 'Adjudicada') totalAdj += Number(t.monto_adjudicado);
        const color = t.status === 'Adjudicada' ? 'bg-green-100 text-green-700 border-green-200' : t.status === 'No Adjudicada' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-orange-100 text-orange-700 border-orange-200';
        body.innerHTML += `<tr class="hover:bg-slate-50 transition"><td class="px-8 py-6 font-bold text-slate-800">${t.nombre_licitacion}<br><span class="text-[10px] text-slate-400 font-mono">${t.codigo_id}</span></td><td class="px-8 py-6 text-xs font-bold text-slate-500">${t.evaluacion}</td><td class="px-8 py-6 font-black">$${Number(t.monto_adjudicado).toLocaleString('es-CL')}</td><td class="px-8 py-6"><span class="status-pill border ${color}">${t.status}</span></td><td class="px-8 py-6 text-center"><button class="p-3 bg-slate-100 rounded-xl hover:bg-slate-900 hover:text-white transition"><i data-lucide="calculator" class="w-4 h-4"></i></button></td></tr>`;
    });
    document.getElementById('kpi-monto').innerText = `$${totalAdj.toLocaleString('es-CL')}`;
    document.getElementById('kpi-count').innerText = data.length;
    lucide.createIcons();
}

// STORAGE PDF
async function loadFiles() {
    const grid = document.getElementById('file-grid');
    grid.innerHTML = '<p class="col-span-3 text-center text-slate-400 py-20">Buscando documentos...</p>';
    const { data, error } = await supabaseClient.storage.from('documentos').list(currentPath);
    if (error) return;
    grid.innerHTML = '';
    data.forEach(f => {
        grid.innerHTML += `<div class="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex items-center justify-between group hover:border-red-500 transition"><div class="flex items-center gap-4"><div class="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center"><i data-lucide="file-text"></i></div><div><p class="font-bold text-slate-800 text-xs truncate w-32">${f.name}</p><p class="text-[9px] text-slate-400 font-black uppercase tracking-tighter">PDF Oficial</p></div></div><button onclick="downloadFile('${f.name}')" class="text-slate-300 hover:text-indigo-600"><i data-lucide="download"></i></button></div>`;
    });
    lucide.createIcons();
}

async function uploadFile() {
    const file = document.getElementById('file-input').files[0];
    if (!file) return;
    const path = `${currentPath}/${Date.now()}_${file.name}`;
    const { error } = await supabaseClient.storage.from('documentos').upload(path, file);
    if (!error) loadFiles();
}

async function downloadFile(name) {
    const { data } = await supabaseClient.storage.from('documentos').download(`${currentPath}/${name}`);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(data); a.download = name; a.click();
}

// BOT ANALIZADOR IA (DETALLADO)
async function analyzePDF() {
    const file = document.getElementById('ia-file').files[0];
    if (!file) return;
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

        const patterns = {
            anexos: [{n:"Boleta Seriedad", p:["garantia", "seriedad"]}, {n:"Anexo Administrativo", p:["anexo 1", "oferente"]}, {n:"Declaración Jurada", p:["jurada", "inhabilidades"]}],
            eco: [{n:"Presupuesto Máximo", p:["presupuesto", "maximo", "disponible"]}, {n:"Licitación por Líneas", p:["linea 1", "item", "cantidad"]}],
            eval: [{n:"Precio (40-60%)", p:["precio", "economica", "puntaje"]}, {n:"Experiencia (20-30%)", p:["experiencia", "años", "curriculum"]}],
            prof: [{n:"Neurólogo", p:["neurologo", "neurologia"]}, {n:"Pediatra", p:["pediatra", "pediatria"]}, {n:"Médico Familiar", p:["familiar", "medico familiar"]}]
        };

        const filter = (list) => list.filter(k => k.p.some(p => raw.includes(p)));

        const renderIA = (id, data, icon) => {
            const container = document.getElementById(id);
            container.innerHTML = data.length ? data.map(d => `<div class="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between text-xs font-bold text-slate-700"><span>${d.n}</span><i data-lucide="check-circle-2" class="w-4 h-4 text-green-500"></i></div>`).join('') : '<p class="text-[10px] italic text-slate-400">No detectado explícitamente.</p>';
        };

        renderIA('ia-anexos', filter(patterns.anexos));
        renderIA('ia-economico', filter(patterns.eco));
        renderIA('ia-evaluacion', filter(patterns.eval));
        renderIA('ia-profesionales', filter(patterns.prof));

        setTimeout(() => {
            document.getElementById('ia-loading').classList.add('hidden');
            document.getElementById('ia-result').classList.remove('hidden');
            lucide.createIcons();
        }, 1500);
    };
    reader.readAsArrayBuffer(file);
}

// FUNCIONES GENERALES
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function logout() { supabaseClient.auth.signOut().then(() => location.href='login.html'); }

document.getElementById('tender-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nueva = {
        nombre_licitacion: document.getElementById('t-nombre').value,
        codigo_id: document.getElementById('t-id').value,
        monto_adjudicado: Number(document.getElementById('t-monto').value),
        evaluacion: document.getElementById('t-eval').value,
        status: document.getElementById('t-status').value
    };
    const { error } = await supabaseClient.from('licitaciones').insert([nueva]);
    if (!error) { closeModal('modal-licitacion'); fetchLicitaciones(); document.getElementById('tender-form').reset(); }
});
