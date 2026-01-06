// 1. CONFIGURACIÓN
const SB_URL = "https://ybwtjxgvicebwmyhkhda.supabase.co";
const SB_KEY = "sb_publishable_Ae-JOXtX_fLpFTMgne_4Sw_jiGrdCMp";
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

let currentPath = "ordenes";

// 2. NAVEGACIÓN (Corregido)
function switchView(view) {
    // Ocultar todas
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
        document.getElementById('view-title').innerText = "Analizador IA";
    } else {
        document.getElementById('view-files').classList.add('active');
        document.getElementById(`nav-${view}`).classList.add('active');
        document.getElementById('view-title').innerText = "Repositorio: " + view.toUpperCase();
        
        currentPath = view;
        staffNav.classList.toggle('hidden', view !== 'staff');
        if (view === 'staff') currentPath = "staff/neurologia";
        loadFiles();
    }
    lucide.createIcons();
}

function changeFolder(path) { currentPath = path; loadFiles(); }

// 3. DATOS SUPABASE
async function fetchLicitaciones() {
    const { data, error } = await supabaseClient.from('licitaciones').select('*').order('created_at', { ascending: false });
    if (error) return;

    const body = document.getElementById('tender-table-body');
    body.innerHTML = '';
    let totalAdj = 0;

    data.forEach(t => {
        if(t.status === 'Adjudicada') totalAdj += Number(t.monto_adjudicado);
        const color = t.status === 'Adjudicada' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-orange-100 text-orange-700 border-orange-200';
        body.innerHTML += `
            <tr class="hover:bg-slate-50">
                <td class="px-8 py-6 font-bold text-slate-800">${t.nombre_licitacion}<br><span class="text-[10px] text-slate-400 font-mono">${t.codigo_id}</span></td>
                <td class="px-8 py-6 text-[10px] font-bold text-slate-500 uppercase">${t.evaluacion}</td>
                <td class="px-8 py-6 font-black">$${Number(t.monto_adjudicado).toLocaleString('es-CL')}</td>
                <td class="px-8 py-6"><span class="status-pill ${color}">${t.status}</span></td>
                <td class="px-8 py-6 text-center"><button class="p-3 bg-slate-100 rounded-xl hover:bg-black hover:text-white transition"><i data-lucide="calculator" class="w-4 h-4"></i></button></td>
            </tr>`;
    });
    document.getElementById('kpi-monto').innerText = `$${totalAdj.toLocaleString('es-CL')}`;
    document.getElementById('kpi-count').innerText = data.length;
    lucide.createIcons();
}

// 4. STORAGE
async function loadFiles() {
    const grid = document.getElementById('file-grid');
    grid.innerHTML = '<p class="col-span-3 text-center py-20 text-slate-400 font-bold uppercase text-[10px] tracking-widest">Sincronizando Archivos...</p>';
    const { data, error } = await supabaseClient.storage.from('documentos').list(currentPath);
    if (error) return;
    
    grid.innerHTML = '';
    data.forEach(f => {
        grid.innerHTML += `<div class="bg-white p-6 rounded-3xl border border-slate-200 flex justify-between items-center group hover:border-red-500 transition-all shadow-sm">
            <div class="flex items-center gap-3"><i data-lucide="file-text" class="text-red-600"></i><p class="text-xs font-bold text-slate-700 truncate w-32">${f.name}</p></div>
            <button onclick="downloadFile('${f.name}')" class="text-slate-300 hover:text-indigo-600"><i data-lucide="download"></i></button>
        </div>`;
    });
    lucide.createIcons();
}

async function uploadFile() {
    const file = document.getElementById('file-input').files[0];
    if(!file) return;
    const path = `${currentPath}/${Date.now()}_${file.name}`;
    await supabaseClient.storage.from('documentos').upload(path, file);
    loadFiles();
}

async function downloadFile(name) {
    const { data } = await supabaseClient.storage.from('documentos').download(`${currentPath}/${name}`);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(data); a.download = name; a.click();
}

// 5. IA ANALIZADOR
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
            container.innerHTML = patterns.filter(p => p.words.some(w => raw.includes(w))).map(p => `<div class="p-2 bg-white rounded-lg border mb-1 flex justify-between items-center"><span>${p.name}</span><i data-lucide="check" class="w-3 h-3 text-green-500"></i></div>`).join('') || 'No detectado.';
        }

        mapIA('ia-anexos', [{name:"Boleta Seriedad", words:["boleta","garantia","seriedad"]}, {name:"Declaración Jurada", words:["jurada","inhabilidades"]}]);
        mapIA('ia-economico', [{name:"Presupuesto Máximo", words:["presupuesto","maximo","clp","$"]}]);
        mapIA('ia-evaluacion', [{name:"Criterio Precio", words:["precio","economica","puntaje"]}]);
        mapIA('ia-profesionales', [{name:"Especialista", words:["neurologo","pediatra","familiar"]}]);

        document.getElementById('ia-loading').classList.add('hidden');
        document.getElementById('ia-result').classList.remove('hidden');
        lucide.createIcons();
    };
    reader.readAsArrayBuffer(file);
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
        status: document.getElementById('t-status').value
    };
    const { error } = await supabaseClient.from('licitaciones').insert([nueva]);
    if (!error) { closeModal('modal-licitacion'); fetchLicitaciones(); document.getElementById('tender-form').reset(); }
});

// Carga de iconos inicial
lucide.createIcons();
