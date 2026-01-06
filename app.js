const SB_URL = "https://ybwtjxgvicebwmyhkhda.supabase.co";
const SB_KEY = "sb_publishable_Ae-JOXtX_fLpFTMgne_4Sw_jiGrdCMp";
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

let currentPath = "ordenes";
let licitacionesCache = [];

// INICIO Y SEGURIDAD
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { 
        window.location.replace('login.html'); 
        return; 
    }
    document.body.style.opacity = "1";
    fetchLicitaciones();
    lucide.createIcons();

    // VINCULACIÓN DEL FORMULARIO DE LICITACIÓN
    const tenderForm = document.getElementById('tender-form');
    if(tenderForm) {
        tenderForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nueva = {
                nombre_licitacion: document.getElementById('t-nombre').value,
                codigo_id: document.getElementById('t-id').value,
                monto_adjudicado: Number(document.getElementById('t-monto').value),
                evaluacion: document.getElementById('t-eval').value,
                status: 'Pendiente'
            };

            const { error } = await supabaseClient.from('licitaciones').insert([nueva]);
            
            if (!error) { 
                closeModal('modal-licitacion'); 
                fetchLicitaciones(); 
                tenderForm.reset(); 
            } else {
                alert("Error al guardar en Supabase: " + error.message);
            }
        });
    }
});

// NAVEGACIÓN
function switchView(view) {
    document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar-item').forEach(l => l.classList.remove('active'));
    
    const targetSection = document.getElementById(`view-${view === 'ia' ? 'ia' : (view === 'dashboard' ? 'dashboard' : 'files')}`);
    const targetNav = document.getElementById(`nav-${view}`);

    if(targetSection) targetSection.classList.add('active');
    if(targetNav) targetNav.classList.add('active');
    
    document.getElementById('view-title').innerText = view.charAt(0).toUpperCase() + view.slice(1);
    
    if (view === 'dashboard') fetchLicitaciones();
    else if (view !== 'ia') { currentPath = view; loadFiles(); }
    
    const staffNav = document.getElementById('staff-folders');
    if(staffNav) staffNav.classList.toggle('hidden', view !== 'staff');
    
    lucide.createIcons();
}

// CARGA DE LICITACIONES
async function fetchLicitaciones() {
    const { data, error } = await supabaseClient.from('licitaciones').select('*').order('created_at', { ascending: false });
    if (error) return;

    licitacionesCache = data || [];
    const body = document.getElementById('tender-table-body');
    if(!body) return;
    
    body.innerHTML = '';
    let totalAdj = 0;

    licitacionesCache.forEach(t => {
        if(t.status === 'Adjudicada') totalAdj += Number(t.monto_adjudicado);
        
        let statusClass = "text-slate-400 border-slate-100";
        if(t.status === 'Adjudicada') statusClass = "bg-emerald-50 text-emerald-600 border-emerald-100";
        if(t.status === 'No Adjudicada') statusClass = "bg-rose-50 text-rose-600 border-rose-100";
        if(t.status === 'Pendiente') statusClass = "bg-amber-50 text-amber-600 border-amber-100";

        body.innerHTML += `
            <tr class="hover:bg-slate-50/50 transition border-b border-slate-50">
                <td class="px-8 py-5 font-semibold text-slate-800">
                    ${t.nombre_licitacion}
                    <br><span class="text-[9px] text-slate-400 font-bold uppercase tracking-widest">${t.codigo_id}</span>
                </td>
                <td class="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">${t.evaluacion}</td>
                <td class="px-8 py-5 font-bold text-slate-700">$${Number(t.monto_adjudicado).toLocaleString('es-CL')}</td>
                <td class="px-8 py-5">
                    <select onchange="updateStatus('${t.id}', this.value)" class="select-status ${statusClass}">
                        <option value="Pendiente" ${t.status === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                        <option value="Adjudicada" ${t.status === 'Adjudicada' ? 'selected' : ''}>Adjudicada</option>
                        <option value="No Adjudicada" ${t.status === 'No Adjudicada' ? 'selected' : ''}>No Adjudicada</option>
                    </select>
                </td>
                <td class="px-8 py-5 text-center"><button class="text-slate-200 hover:text-slate-800 transition"><i data-lucide="calculator" class="w-4 h-4"></i></button></td>
            </tr>`;
    });
    
    document.getElementById('kpi-monto').innerText = `$${totalAdj.toLocaleString('es-CL')}`;
    document.getElementById('kpi-count').innerText = licitacionesCache.length;
    lucide.createIcons();
}

// ACTUALIZAR ESTATUS MANUAL
async function updateStatus(id, newStatus) {
    const { error } = await supabaseClient.from('licitaciones').update({ status: newStatus }).eq('id', id);
    if (!error) fetchLicitaciones();
}

// STORAGE CON TÍTULO
function triggerUpload() {
    if (!document.getElementById('file-title').value) return alert("Por favor, ingrese un título descriptivo.");
    document.getElementById('file-input').click();
}

async function uploadFile() {
    const fileInput = document.getElementById('file-input');
    const userTitle = document.getElementById('file-title').value;
    const file = fileInput.files[0];
    if(!file) return;

    const finalName = `${userTitle.replace(/ /g, '_').toUpperCase()}__${Date.now()}__.pdf`;
    const { error } = await supabaseClient.storage.from('documentos').upload(`${currentPath}/${finalName}`, file);
    
    if (!error) { 
        document.getElementById('file-title').value = ''; 
        loadFiles(); 
    }
}

async function loadFiles() {
    const grid = document.getElementById('file-grid');
    grid.innerHTML = '<p class="col-span-3 text-center text-slate-300 text-[10px] py-20 font-bold tracking-widest uppercase">Syncing Repository...</p>';
    const { data } = await supabaseClient.storage.from('documentos').list(currentPath);
    grid.innerHTML = '';
    data.forEach(f => {
        const title = f.name.split('__')[0].replace(/_/g, ' ');
        grid.innerHTML += `
            <div class="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all group">
                <div>
                    <span class="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] mb-2 block italic">Documento</span>
                    <h5 class="font-bold text-slate-800 text-sm leading-tight mb-4">${title}</h5>
                </div>
                <div class="flex justify-between items-center border-t border-slate-50 pt-4">
                    <i data-lucide="file-text" class="text-slate-100 w-5 h-5 transition-colors group-hover:text-red-500"></i>
                    <button onclick="downloadFile('${f.name}')" class="text-slate-900 font-bold text-[10px] uppercase hover:underline">Descargar</button>
                </div>
            </div>`;
    });
    lucide.createIcons();
}

async function downloadFile(name) {
    const { data } = await supabaseClient.storage.from('documentos').download(`${currentPath}/${name}`);
    const a = document.createElement('a'); a.href = URL.createObjectURL(data); a.download = name; a.click();
}

// ANALIZADOR IA DE ÉLITE
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

        // INFORME MAESTRO
        let report = "";
        if (raw.includes("licitacion publica")) report += "<p>• Se identifica como una <strong>Licitación Pública</strong>. El cumplimiento de plazos y la solvencia económica son el factor decisivo para el puntaje final.</p>";
        if (raw.includes("multa") || raw.includes("sancion")) report += "<p>• 🚨 <strong>Alerta Estratégica:</strong> Las bases detectan cláusulas punitivas de <u>multas por atraso</u>. CardioHome SpA debe asegurar contingencia logística.</p>";
        if (raw.includes("neurolog")) report += "<p>• 🩺 <strong>Especialidad:</strong> El staff requerido debe acreditar título en <u>Neurología</u>. Se recomienda validar registros en la SIS antes de subir los archivos.</p>";
        if (raw.includes("pediatra")) report += "<p>• 🩺 <strong>Especialidad:</strong> Proceso centrado en <u>Pediatría</u>. La experiencia clínica previa en sector público suma puntaje diferenciador.</p>";

        document.getElementById('ia-detailed-report').innerHTML = report || "No se detectaron requerimientos de alta complejidad. Proceso administrativamente estándar.";

        const mapIA = (id, patterns) => {
            const container = document.getElementById(id);
            container.innerHTML = patterns.filter(p => p.words.some(w => raw.includes(w))).map(p => `
                <div class="flex items-center justify-between text-[11px] font-bold text-slate-700 border-b border-slate-50 py-3 italic">
                    <span>${p.name}</span><i data-lucide="check-circle" class="text-emerald-500 w-4 h-4"></i>
                </div>`).join('') || '<span class="text-slate-300 text-[10px] font-bold">Sin registros.</span>';
        }

        mapIA('ia-anexos', [{name:"Boleta de Seriedad", words:["boleta","garantia","seriedad"]}, {name:"Declaración Jurada", words:["jurada","inhabilidades"]}, {name:"Garantía Fiel Cumplimiento", words:["fiel","cumplimiento"]}]);
        mapIA('ia-profesionales', [{name:"Neurólogo", words:["neurologo","neurologia"]}, {name:"Pediatra", words:["pediatra","pediatria"]}, {name:"Familiar", words:["familiar","familia"]}]);

        document.getElementById('ia-loading').classList.add('hidden');
        document.getElementById('ia-result').classList.remove('hidden');
        lucide.createIcons();
    };
    reader.readAsArrayBuffer(file);
}

// GENERAL
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function changeFolder(path) { currentPath = path; loadFiles(); }
function logout() { supabaseClient.auth.signOut().then(() => window.location.replace('login.html')); }
