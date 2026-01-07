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

    // VINCULACIÓN DEL FORMULARIO DE LICITACIÓN + ANEXOS
    const tenderForm = document.getElementById('tender-form');
    if(tenderForm) {
        tenderForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nombre = document.getElementById('t-nombre').value;
            const idLic = document.getElementById('t-id').value;
            const monto = Number(document.getElementById('t-monto').value);
            
            // Insertar Licitación Principal
            const { data: licData, error: licError } = await supabaseClient
                .from('licitaciones')
                .insert([{ nombre_licitacion: nombre, codigo_id: idLic, monto_adjudicado: monto, status: 'Pendiente' }])
                .select();

            if (!licError && licData) {
                const newId = licData[0].id;
                // Capturar Anexos definidos en el modal
                const anexoInputs = document.querySelectorAll('.anexo-input');
                const anexosToInsert = Array.from(anexoInputs)
                    .filter(input => input.value.trim() !== "")
                    .map(input => ({ licitacion_id: newId, titulo_anexo: input.value }));

                if(anexosToInsert.length > 0) {
                    await supabaseClient.from('anexos_licitacion').insert(anexosToInsert);
                }

                closeModal('modal-licitacion');
                fetchLicitaciones();
                tenderForm.reset();
            }
        });
    }
});

// 3. NAVEGACIÓN DINÁMICA
function switchView(view) {
    document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar-item').forEach(l => l.classList.remove('active'));
    
    // Corregido: Identificar vistas correctamente incluyendo 'legal'
    const targetSection = document.getElementById(`view-${(view === 'dashboard' || view === 'ia') ? view : 'files'}`);
    const targetNav = document.getElementById(`nav-${view}`);

    if(targetSection) targetSection.classList.add('active');
    if(targetNav) targetNav.classList.add('active');
    
    document.getElementById('view-title').innerText = view.toUpperCase();
    
    if (view === 'dashboard') fetchLicitaciones();
    else if (view !== 'ia') { 
        currentPath = view; 
        loadFiles(); 
    }
    
    const staffNav = document.getElementById('staff-folders');
    if(staffNav) staffNav.classList.toggle('hidden', view !== 'staff');
    
    lucide.createIcons();
}

function changeFolder(path) { currentPath = path; loadFiles(); }

// 4. GESTIÓN DE LICITACIONES
async function fetchLicitaciones() {
    const { data, error } = await supabaseClient.from('licitaciones').select('*').order('created_at', { ascending: false });
    if (error) return;

    licitacionesCache = data || [];
    const body = document.getElementById('tender-table-body');
    body.innerHTML = '';
    let totalAdj = 0;

    licitacionesCache.forEach(t => {
        if(t.status === 'Adjudicada') totalAdj += Number(t.monto_adjudicado);
        
        let color = t.status === 'Adjudicada' ? "bg-emerald-500 text-white" : t.status === 'No Adjudicada' ? "bg-rose-500 text-white" : "bg-amber-400 text-white";

        body.innerHTML += `
            <tr class="hover:bg-slate-50/50 transition border-b border-slate-50">
                <td class="px-8 py-5">
                    <p class="font-bold text-slate-800 text-sm">${t.nombre_licitacion}</p>
                    <span class="text-[9px] text-slate-400 font-bold uppercase tracking-widest">${t.codigo_id}</span>
                </td>
                <td class="px-8 py-5 text-center">
                    <button onclick="openAnexos('${t.id}', '${t.nombre_licitacion}')" class="text-[10px] font-black border px-4 py-2 rounded-xl hover:bg-slate-900 hover:text-white transition uppercase">
                        GESTIÓN DOCUMENTAL
                    </button>
                </td>
                <td class="px-8 py-5 font-bold text-slate-700">$${Number(t.monto_adjudicado).toLocaleString('es-CL')}</td>
                <td class="px-8 py-5">
                    <select onchange="updateStatus('${t.id}', this.value)" class="status-badge ${color}">
                        <option value="Pendiente" ${t.status === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                        <option value="Adjudicada" ${t.status === 'Adjudicada' ? 'selected' : ''}>Adjudicada</option>
                        <option value="No Adjudicada" ${t.status === 'No Adjudicada' ? 'selected' : ''}>No Adjudicada</option>
                    </select>
                </td>
                <td class="px-8 py-5 text-center">
                    <button onclick="openSimulador('${t.id}')" class="p-3 bg-slate-100 rounded-xl hover:bg-slate-900 hover:text-white transition">
                        <i data-lucide="calculator" class="w-4 h-4"></i>
                    </button>
                </td>
            </tr>`;
    });
    document.getElementById('kpi-monto').innerText = `$${totalAdj.toLocaleString('es-CL')}`;
    document.getElementById('kpi-count').innerText = licitacionesCache.length;
    lucide.createIcons();
}

async function updateStatus(id, newStatus) {
    await supabaseClient.from('licitaciones').update({ status: newStatus }).eq('id', id);
    fetchLicitaciones();
}

// 5. GESTIÓN DE ANEXOS CON SUBIDA DE ARCHIVOS
function addAnexoInput() {
    const container = document.getElementById('anexos-input-list');
    const input = document.createElement('input');
    input.className = "w-full p-2 bg-slate-50 border rounded-lg text-xs anexo-input mt-2";
    input.placeholder = "Título del Anexo Requerido";
    container.appendChild(input);
}

async function openAnexos(id, name) {
    document.getElementById('modal-anexos').classList.remove('hidden');
    document.getElementById('anexos-lic-nombre').innerText = name;
    loadAnexos(id);
}

async function loadAnexos(licId) {
    const { data } = await supabaseClient.from('anexos_licitacion').select('*').eq('licitacion_id', licId).order('created_at', { ascending: true });
    const list = document.getElementById('anexos-list'); 
    list.innerHTML = '';

    data.forEach(a => {
        let style = a.estado === 'Completado' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100';
        list.innerHTML += `
            <div class="flex justify-between items-center p-5 bg-white border border-slate-100 rounded-3xl shadow-sm">
                <div>
                    <p class="font-bold text-sm text-slate-800">${a.titulo_anexo}</p>
                    <select onchange="updateAnexoStatus('${a.id}', this.value, '${licId}')" class="text-[9px] font-bold p-1 rounded-md border mt-2 ${style}">
                        <option value="Pendiente" ${a.estado === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                        <option value="Completado" ${a.estado === 'Completado' ? 'selected' : ''}>Completado</option>
                    </select>
                </div>
                <div class="flex items-center gap-4">
                    <input type="file" id="file-${a.id}" class="hidden" accept=".pdf" onchange="uploadAnexoFile('${a.id}', '${licId}')">
                    
                    ${a.url_archivo ? `
                        <button onclick="downloadAnexo('${a.url_archivo}', '${a.titulo_anexo}')" class="text-indigo-600 hover:scale-110 transition">
                            <i data-lucide="download-cloud"></i>
                        </button>` : ''}
                    
                    <button onclick="document.getElementById('file-${a.id}').click()" class="text-slate-200 hover:text-indigo-600 transition">
                        <i data-lucide="upload-cloud"></i>
                    </button>
                </div>
            </div>`;
    });
    lucide.createIcons();
}

async function uploadAnexoFile(anexoId, licId) {
    const fileInput = document.getElementById(`file-${anexoId}`);
    const file = fileInput.files[0];
    if(!file) return;

    const path = `anexos/${anexoId}_${Date.now()}.pdf`;
    
    // 1. Subir al Storage de Supabase
    const { error: uploadError } = await supabaseClient.storage.from('documentos').upload(path, file);
    
    if (!uploadError) {
        // 2. Actualizar la base de datos con la URL y marcar como COMPLETADO
        await supabaseClient.from('anexos_licitacion')
            .update({ url_archivo: path, estado: 'Completado' })
            .eq('id', anexoId);
        
        loadAnexos(licId);
    } else {
        alert("Error al subir anexo: " + uploadError.message);
    }
}

async function downloadAnexo(path, title) {
    const { data, error } = await supabaseClient.storage.from('documentos').download(path);
    if (!error) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(data);
        a.download = `${title.replace(/ /g, '_')}.pdf`;
        a.click();
    }
}

async function updateAnexoStatus(id, status, licId) {
    await supabaseClient.from('anexos_licitacion').update({ estado: status }).eq('id', id);
    loadAnexos(licId);
}

// 6. REPOSITORIO GENERAL (Órdenes, Legal, Staff)
function triggerUpload() {
    if (!document.getElementById('file-title').value) return alert("Define qué documento es.");
    document.getElementById('file-input').click();
}

async function uploadFile() {
    const fileInput = document.getElementById('file-input');
    const userTitle = document.getElementById('file-title').value;
    const file = fileInput.files[0];
    if(!file) return;

    const finalName = `${userTitle.replace(/ /g, '_').toUpperCase()}__${Date.now()}__.pdf`;
    await supabaseClient.storage.from('documentos').upload(`${currentPath}/${finalName}`, file);
    document.getElementById('file-title').value = ''; 
    loadFiles();
}

async function loadFiles() {
    const grid = document.getElementById('file-grid');
    grid.innerHTML = '<p class="col-span-3 text-center py-20 text-slate-400 font-black text-[10px] animate-pulse">SINCRONIZANDO...</p>';
    
    const { data } = await supabaseClient.storage.from('documentos').list(currentPath);
    grid.innerHTML = '';
    
    if(data) {
        data.forEach(f => {
            const title = f.name.split('__')[0].replace(/_/g, ' ');
            grid.innerHTML += `
                <div class="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between hover:border-red-500 transition-all">
                    <div>
                        <span class="text-[9px] font-bold text-slate-300 uppercase tracking-widest block mb-2">Archivo</span>
                        <h5 class="font-bold text-slate-800 text-sm leading-tight mb-4">${title}</h5>
                    </div>
                    <button onclick="downloadGeneralFile('${f.name}')" class="bg-slate-900 text-white p-2 rounded-xl text-[10px] font-bold uppercase hover:bg-red-600 transition">
                        Descargar
                    </button>
                </div>`;
        });
    }
    lucide.createIcons();
}

async function downloadGeneralFile(name) {
    const { data } = await supabaseClient.storage.from('documentos').download(`${currentPath}/${name}`);
    const a = document.createElement('a'); 
    a.href = URL.createObjectURL(data); 
    a.download = name; 
    a.click();
}

// 7. IA ANALIZADOR ESTRATÉGICO
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

        // INFORME ESTRATÉGICO
        let report = "";
        if (raw.includes("licitacion publica")) report += "<p>• 🛡️ <strong>Diagnóstico:</strong> Licitación Pública detectada. Se recomienda estricto cumplimiento de anexos administrativos.</p>";
        if (raw.includes("multa")) report += "<p>• 🚨 <strong>Alerta:</strong> Se detectan cláusulas de sanciones por retrasos logísticos.</p>";
        if (raw.includes("neurolog")) report += "<p>• 🩺 <strong>Directriz:</strong> Perfil requerido: Neurología. Usar staff acreditado SIS.</p>";

        document.getElementById('ia-detailed-report').innerHTML = report || "Proceso estándar analizado.";

        const mapIA = (id, patterns) => {
            const container = document.getElementById(id);
            container.innerHTML = patterns.filter(p => p.words.some(w => raw.includes(w))).map(p => `
                <div class="p-3 bg-slate-50 border rounded-xl flex justify-between font-bold text-[9px] uppercase">
                    <span>${p.name}</span><i data-lucide="check-circle" class="text-green-500 w-3 h-3"></i>
                </div>`).join('') || '<span class="text-slate-300 text-[10px]">Sin hallazgos.</span>';
        }

        mapIA('ia-anexos', [{name:"Boleta Seriedad", words:["boleta","garantia"]}, {name:"Declaración Jurada", words:["jurada","inhabilidades"]}]);
        mapIA('ia-profesionales', [{name:"Especialista", words:["neurologo","pediatra","familiar"]}]);

        document.getElementById('ia-loading').classList.add('hidden');
        document.getElementById('ia-result').classList.remove('hidden');
        lucide.createIcons();
    };
    reader.readAsArrayBuffer(file);
}

// 8. SIMULADOR
function openSimulador(id) {
    currentLicitacion = licitacionesCache.find(l => l.id === id);
    document.getElementById('sim-nombre').innerText = currentLicitacion.nombre_licitacion;
    document.getElementById('modal-simulador').classList.remove('hidden');
    calculate();
}

function calculate() {
    if(!currentLicitacion) return;
    const total = currentLicitacion.monto_adjudicado;
    const gastos = (Number(document.getElementById('gasto-medico').value) || 0) + (Number(document.getElementById('gasto-logistica').value) || 0);
    const utilidad = total - gastos;
    document.getElementById('sim-resultado').innerText = `$${utilidad.toLocaleString('es-CL')}`;
    document.getElementById('sim-bar').style.width = `${Math.max(0, Math.min((utilidad/total)*100, 100))}%`;
}

// FUNCIONES GENERALES
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function logout() { supabaseClient.auth.signOut().then(() => window.location.replace('login.html')); }
