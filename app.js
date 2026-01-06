// 1. CONFIGURACIÓN SUPABASE
const SB_URL = "https://ybwtjxgvicebwmyhkhda.supabase.co";
const SB_KEY = "sb_publishable_Ae-JOXtX_fLpFTMgne_4Sw_jiGrdCMp";
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

let currentPath = "ordenes";
let licitacionesCache = [];

// 2. INICIO Y SEGURIDAD (ARREGLADO)
document.addEventListener('DOMContentLoaded', async () => {
    // Verificar sesión antes de mostrar nada
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session) {
        window.location.replace('login.html');
        return;
    }

    // Mostrar el cuerpo de la página una vez verificado
    document.body.style.opacity = "1";
    
    // Cargar datos
    fetchLicitaciones();
    lucide.createIcons();
});

// 3. NAVEGACIÓN (Funcionalidad de Botones Lateral)
function switchView(view) {
    // Ocultar todas las secciones
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
        title.innerText = "Analizador Inteligente IA";
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

// 4. LICITACIONES (Carga de tabla)
async function fetchLicitaciones() {
    const { data, error } = await supabaseClient.from('licitaciones').select('*').order('created_at', { ascending: false });
    if (error) return console.error(error);

    licitacionesCache = data;
    const body = document.getElementById('tender-table-body');
    body.innerHTML = '';
    let totalAdj = 0;

    data.forEach(t => {
        if(t.status === 'Adjudicada') totalAdj += Number(t.monto_adjudicado);
        const color = t.status === 'Adjudicada' ? 'bg-green-100 text-green-700 border-green-200' : 
                      t.status === 'No Adjudicada' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-orange-100 text-orange-700 border-orange-200';
        
        body.innerHTML += `
            <tr class="hover:bg-slate-50 transition">
                <td class="px-8 py-6 font-bold text-slate-800">${t.nombre_licitacion}<br><span class="text-[10px] text-slate-400 font-mono">${t.codigo_id}</span></td>
                <td class="px-8 py-6 text-[10px] font-bold text-slate-500 uppercase">${t.evaluacion}</td>
                <td class="px-8 py-6 font-black">$${Number(t.monto_adjudicado).toLocaleString('es-CL')}</td>
                <td class="px-8 py-6"><span class="status-pill ${color}">${t.status}</span></td>
                <td class="px-8 py-6 text-center">
                    <button class="p-2 bg-slate-100 rounded-lg hover:bg-black hover:text-white transition"><i data-lucide="calculator" class="w-4 h-4"></i></button>
                </td>
            </tr>`;
    });
    document.getElementById('kpi-monto').innerText = `$${totalAdj.toLocaleString('es-CL')}`;
    document.getElementById('kpi-count').innerText = data.length;
    lucide.createIcons();
}

// 5. STORAGE (Subida y descarga de archivos)
async function loadFiles() {
    const grid = document.getElementById('file-grid');
    grid.innerHTML = '<p class="col-span-3 text-center py-20 text-slate-400 font-black text-xs uppercase animate-pulse tracking-widest">Sincronizando con la nube...</p>';
    
    const { data, error } = await supabaseClient.storage.from('documentos').list(currentPath);
    if (error) return;
    
    grid.innerHTML = '';
    data.forEach(f => {
        grid.innerHTML += `
            <div class="bg-white p-6 rounded-3xl border border-slate-200 flex justify-between items-center group hover:border-red-500 transition shadow-sm">
                <div class="flex items-center gap-3">
                    <i data-lucide="file-text" class="text-red-600"></i>
                    <p class="text-[11px] font-bold text-slate-700 truncate w-32 uppercase tracking-tighter">${f.name}</p>
                </div>
                <button onclick="downloadFile('${f.name}')" class="text-slate-300 hover:text-indigo-600 transition"><i data-lucide="download"></i></button>
            </div>`;
    });
    lucide.createIcons();
}

async function uploadFile() {
    const file = document.getElementById('file-input').files[0];
    if(!file) return;
    const path = `${currentPath}/${Date.now()}_${file.name}`;
    const { error } = await supabaseClient.storage.from('documentos').upload(path, file);
    if (!error) loadFiles();
    else alert("Error al subir: " + error.message);
}

async function downloadFile(name) {
    const { data } = await supabaseClient.storage.from('documentos').download(`${currentPath}/${name}`);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(data); a.download = name; a.click();
}

// 6. ANALIZADOR IA
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

        const mapIA = (id, patterns) => {
            const container = document.getElementById(id);
            container.innerHTML = patterns.filter(p => p.words.some(w => raw.includes(w))).map(p => `<div class="p-3 bg-white rounded-xl border border-slate-100 mb-1 flex justify-between items-center font-bold text-[10px]"><span>${p.name}</span><i data-lucide="check-circle" class="w-3 h-3 text-green-500"></i></div>`).join('') || '<span class="text-slate-300 italic">No detectado.</span>';
        }

        mapIA('ia-anexos', [{name:"Boleta Garantía", words:["boleta","garantia","seriedad"]}, {name:"Declaración Jurada", words:["jurada","inhabilidades"]}]);
        mapIA('ia-economico', [{name:"Presupuesto Máximo", words:["presupuesto","maximo","clp","$"]}]);
        mapIA('ia-evaluacion', [{name:"Criterio Económico", words:["precio","economica","puntaje"]}]);
        mapIA('ia-profesionales', [{name:"Especialista Médico", words:["neurologo","pediatra","familiar"]}]);

        document.getElementById('ia-loading').classList.add('hidden');
        document.getElementById('ia-result').classList.remove('hidden');
        lucide.createIcons();
    };
    reader.readAsArrayBuffer(file);
}

// 7. FUNCIONES DE MODAL Y FORMULARIO
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
        status: document.getElementById('t-status').value
    };
    const { error } = await supabaseClient.from('licitaciones').insert([nueva]);
    if (!error) { closeModal('modal-licitacion'); fetchLicitaciones(); document.getElementById('tender-form').reset(); }
    else alert("Error: " + error.message);
});
