const SB_URL = "https://ybwtjxgvicebwmyhkhda.supabase.co";
const SB_KEY = "sb_publishable_Ae-JOXtX_fLpFTMgne_4Sw_jiGrdCMp";
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

let currentPath = "ordenes";

// 1. SEGURIDAD Y CARGA INICIAL
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.href = 'login.html'; return; }
    
    fetchLicitaciones();
    lucide.createIcons();
});

// 2. NAVEGACIÓN ENTRE VISTAS
function switchView(view) {
    document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar-link').forEach(n => n.classList.remove('active'));
    
    document.getElementById(`view-${view === 'ia' ? 'ia' : (view === 'dashboard' ? 'dashboard' : 'files')}`).classList.add('active');
    document.getElementById(`nav-${view}`).classList.add('active');
    
    const title = document.getElementById('view-title');
    const staffNav = document.getElementById('staff-folders');
    
    staffNav.classList.add('hidden');

    if (view === 'dashboard') {
        title.innerText = "Dashboard General";
        fetchLicitaciones();
    } else if (view === 'ia') {
        title.innerText = "Analizador Inteligente";
    } else {
        currentPath = view;
        title.innerText = "Repositorio: " + view.toUpperCase();
        if (view === 'staff') {
            staffNav.classList.remove('hidden');
            currentPath = "staff/neurologia"; // Por defecto
        }
        loadFiles();
    }
}

function changeFolder(path) {
    currentPath = path;
    loadFiles();
}

// 3. GESTIÓN DE LICITACIONES
async function fetchLicitaciones() {
    const { data, error } = await supabaseClient.from('licitaciones').select('*').order('created_at', { ascending: false });
    if (error) return;

    const body = document.getElementById('tender-table-body');
    body.innerHTML = '';
    
    let totalAdj = 0;
    data.forEach(t => {
        if(t.status === 'Adjudicada') totalAdj += Number(t.monto_adjudicado);
        
        const color = t.status === 'Adjudicada' ? 'bg-green-100 text-green-700 border-green-200' : 
                      t.status === 'No Adjudicada' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-orange-100 text-orange-700 border-orange-200';
        
        body.innerHTML += `
            <tr class="hover:bg-slate-50 transition">
                <td class="px-8 py-6">
                    <p class="font-bold text-slate-800">${t.nombre_licitacion}</p>
                    <span class="text-[10px] text-slate-400 font-mono font-bold">${t.codigo_id}</span>
                </td>
                <td class="px-8 py-6 text-sm font-semibold text-slate-500">${t.evaluacion}</td>
                <td class="px-8 py-6 font-black">$${Number(t.monto_adjudicado).toLocaleString('es-CL')}</td>
                <td class="px-8 py-6"><span class="status-pill border ${color}">${t.status}</span></td>
                <td class="px-8 py-6 text-center">
                    <button class="p-3 bg-slate-100 rounded-xl hover:bg-slate-900 hover:text-white transition"><i data-lucide="calculator" class="w-4 h-4"></i></button>
                </td>
            </tr>`;
    });
    
    document.getElementById('kpi-monto').innerText = `$${totalAdj.toLocaleString('es-CL')}`;
    document.getElementById('kpi-count').innerText = data.length;
    lucide.createIcons();
}

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

// 4. STORAGE (PDFs)
async function loadFiles() {
    const grid = document.getElementById('file-grid');
    grid.innerHTML = '<p class="col-span-3 text-center py-10 text-slate-400">Cargando repositorio...</p>';
    
    const { data, error } = await supabaseClient.storage.from('documentos').list(currentPath);
    if (error) return;

    grid.innerHTML = '';
    data.forEach(f => {
        grid.innerHTML += `
            <div class="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex items-center justify-between group hover:border-red-500 transition">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center"><i data-lucide="file-text"></i></div>
                    <div>
                        <p class="font-bold text-slate-800 text-xs truncate w-32">${f.name}</p>
                        <p class="text-[9px] text-slate-400 uppercase font-black">PDF Document</p>
                    </div>
                </div>
                <button onclick="downloadFile('${f.name}')" class="text-slate-300 hover:text-indigo-600"><i data-lucide="download"></i></button>
            </div>`;
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
    a.href = URL.createObjectURL(data);
    a.download = name;
    a.click();
}

// 5. BOT ANALIZADOR IA
async function analyzePDF() {
    const file = document.getElementById('ia-file').files[0];
    if (!file) return;

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

        // Simulación de detección de documentos clave
        const keywords = [
            { name: "Garantía de Seriedad", patterns: ["garantia", "seriedad", "boleta"] },
            { name: "Certificado de Título", patterns: ["titulo", "profesional", "superintendencia"] },
            { name: "Experiencia del Oferente", patterns: ["experiencia", "curriculum", "anexo"] },
            { name: "Seguro de Accidentes", patterns: ["seguro", "accidentes", "ley 16.744"] },
            { name: "Estatutos de la Empresa", patterns: ["estatutos", "constitucion", "sociedad"] }
        ];

        const found = keywords.filter(k => k.patterns.some(p => fullText.toLowerCase().includes(p)));

        // Mostrar resultados
        setTimeout(() => {
            document.getElementById('ia-loading').classList.add('hidden');
            document.getElementById('ia-result').classList.remove('hidden');
            const list = document.getElementById('ia-list');
            list.innerHTML = found.map(f => `
                <div class="flex items-center justify-between p-4 bg-green-50 rounded-2xl border border-green-100">
                    <span class="font-bold text-green-800 text-sm">${f.name}</span>
                    <i data-lucide="check-circle" class="text-green-500 w-5 h-5"></i>
                </div>
            `).join('') || '<p class="text-slate-400">No se detectaron requisitos específicos. Por favor revisa manualmente.</p>';
            lucide.createIcons();
        }, 1500);
    };
    reader.readAsArrayBuffer(file);
}

// MODALES
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function logout() { supabaseClient.auth.signOut().then(() => location.href='login.html'); }
