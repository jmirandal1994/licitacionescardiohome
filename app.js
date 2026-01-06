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
    
    const targetSection = document.getElementById(`view-${view === 'ia' ? 'ia' : (view === 'dashboard' ? 'dashboard' : 'files')}`);
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

// 4. GESTIÓN DE LICITACIONES Y ESTATUS PREMIUM
async function fetchLicitaciones() {
    const { data, error } = await supabaseClient.from('licitaciones').select('*').order('created_at', { ascending: false });
    if (error) return;

    licitacionesCache = data || [];
    const body = document.getElementById('tender-table-body');
    body.innerHTML = '';
    let totalAdj = 0;

    licitacionesCache.forEach(t => {
        if(t.status === 'Adjudicada') totalAdj += Number(t.monto_adjudicado);
        
        let statusStyle = "text-slate-400 border-slate-100";
        if(t.status === 'Adjudicada') statusStyle = "bg-emerald-50 text-emerald-600 border-emerald-100";
        if(t.status === 'No Adjudicada') statusStyle = "bg-rose-50 text-rose-600 border-rose-100";

        body.innerHTML += `
            <tr class="hover:bg-slate-50/50 transition">
                <td class="px-8 py-5">
                    <p class="font-bold text-slate-800 text-sm">${t.nombre_licitacion}</p>
                    <span class="text-[9px] text-slate-400 font-bold uppercase tracking-widest">${t.codigo_id}</span>
                </td>
                <td class="px-8 py-5 text-center">
                    <button onclick="openAnexos('${t.id}', '${t.nombre_licitacion}')" class="text-[10px] font-bold text-indigo-600 border border-indigo-100 bg-indigo-50 px-3 py-1 rounded-lg hover:bg-indigo-600 hover:text-white transition">
                        GESTIÓN ANEXOS
                    </button>
                </td>
                <td class="px-8 py-5 font-bold text-slate-700">$${Number(t.monto_adjudicado).toLocaleString('es-CL')}</td>
                <td class="px-8 py-5">
                    <select onchange="updateStatus('${t.id}', this.value)" class="select-custom ${statusStyle}">
                        <option value="Pendiente" ${t.status === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                        <option value="Adjudicada" ${t.status === 'Adjudicada' ? 'selected' : ''}>Adjudicada</option>
                        <option value="No Adjudicada" ${t.status === 'No Adjudicada' ? 'selected' : ''}>No Adjudicada</option>
                    </select>
                </td>
                <td class="px-8 py-5 text-center">
                    <button onclick="openSimulador('${t.id}')" class="p-2 text-slate-300 hover:text-slate-900 transition">
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

// 5. GESTIÓN DE ANEXOS (VINCULADOS A LICITACIÓN)
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
    const { data } = await supabaseClient.from('anexos_licitacion').select('*').eq('licitacion_id', licId);
    const container = document.getElementById('anexos-list');
    container.innerHTML = '';

    data.forEach(a => {
        let style = a.estado === 'Completado' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100';
        container.innerHTML += `
            <div class="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                <div>
                    <p class="text-sm font-bold text-slate-700">${a.titulo_anexo}</p>
                    <select onchange="updateAnexoStatus('${a.id}', this.value, '${licId}')" class="text-[9px] font-bold p-1 rounded-md border mt-2 ${style}">
                        <option value="Pendiente" ${a.estado === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                        <option value="Completado" ${a.estado === 'Completado' ? 'selected' : ''}>Completado</option>
                    </select>
                </div>
                <i data-lucide="file-check" class="text-slate-200"></i>
            </div>`;
    });
    lucide.createIcons();
}

async function updateAnexoStatus(id, status, licId) {
    await supabaseClient.from('anexos_licitacion').update({ estado: status }).eq('id', id);
    loadAnexos(licId);
}

// 6. REPOSITORIO CON TÍTULOS PERSONALIZADOS
function triggerUpload() {
    if (!document.getElementById('file-title').value) return alert("Ingrese un nombre descriptivo para el archivo.");
    document.getElementById('file-input').click();
}

async function uploadFile() {
    const fileInput = document.getElementById('file-input');
    const userTitle = document.getElementById('file-title').value;
    const file = fileInput.files[0];
    const finalName = `${userTitle.replace(/ /g, '_').toUpperCase()}__${Date.now()}__.pdf`;

    const { error } = await supabaseClient.storage.from('documentos').upload(`${currentPath}/${finalName}`, file);
    if (!error) { 
        document.getElementById('file-title').value = ''; 
        loadFiles(); 
    }
}

async function loadFiles() {
    const grid = document.getElementById('file-grid');
    grid.innerHTML = '<p class="col-span-3 text-center text-slate-300 text-xs py-20 tracking-widest uppercase">Sincronizando...</p>';
    const { data } = await supabaseClient.storage.from('documentos').list(currentPath);
    grid.innerHTML = '';
    data.forEach(f => {
        const title = f.name.split('__')[0].replace(/_/g, ' ');
        grid.innerHTML += `
            <div class="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between hover:border-slate-300 transition group">
                <div>
                    <span class="text-[9px] font-bold text-slate-300 uppercase tracking-widest mb-1 block italic">PDF Oficial</span>
                    <h5 class="font-bold text-slate-800 text-sm leading-tight mb-4">${title}</h5>
                </div>
                <div class="flex justify-between items-center border-t border-slate-50 pt-4">
                    <i data-lucide="file-text" class="text-slate-200 w-4 h-4 group-hover:text-red-500 transition-colors"></i>
                    <button onclick="downloadFile('${f.name}')" class="text-indigo-600 font-bold text-[10px] uppercase hover:underline">Descargar</button>
                </div>
            </div>`;
    });
    lucide.createIcons();
}

async function downloadFile(name) {
    const { data } = await supabaseClient.storage.from('documentos').download(`${currentPath}/${name}`);
    const a = document.createElement('a'); a.href = URL.createObjectURL(data); a.download = name; a.click();
}

// 7. IA ANALIZADOR DE ALTO NIVEL
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
        if (raw.includes("licitacion publica")) report += "<p>• Se confirma <strong>Licitación Pública</strong>. Se requiere máximo rigor en garantías y anexos administrativos.</p>";
        if (raw.includes("multa")) report += "<p>• ⚠️ <strong>ALERTA:</strong> Se detectan cláusulas de multas por atraso. Revisar plazos de respuesta del staff.</p>";
        if (raw.includes("neurolog")) report += "<p>• 🩺 Requerimiento de <strong>Neurología</strong> detectado. Validar acreditación SIS de los médicos asignados.</p>";

        document.getElementById('ia-detailed-report').innerHTML = report || "Proceso estándar. Revisar anexos básicos.";

        const mapIA = (id, patterns) => {
            const container = document.getElementById(id);
            container.innerHTML = patterns.filter(p => p.words.some(w => raw.includes(w))).map(p => `
                <div class="flex items-center justify-between text-[11px] font-medium text-slate-600 border-b border-slate-50 py-2 italic">
                    <span>${p.name}</span><i data-lucide="check" class="text-emerald-500 w-3 h-3"></i>
                </div>`).join('') || '<span class="text-slate-300 text-[10px]">No detectado.</span>';
        }

        mapIA('ia-anexos', [{name:"Boleta Garantía", words:["boleta","garantia"]}, {name:"Declaración Jurada", words:["jurada","inhabilidades"]}]);
        mapIA('ia-profesionales', [{name:"Especialista", words:["neurologo","pediatra","familiar"]}]);

        document.getElementById('ia-loading').classList.add('hidden');
        document.getElementById('ia-result').classList.remove('hidden');
        lucide.createIcons();
    };
    reader.readAsArrayBuffer(file);
}

// 8. SIMULADOR FINANCIERO
function openSimulador(id) {
    currentLicitacion = licitacionesCache.find(l => l.id === id);
    document.getElementById('sim-nombre').innerText = currentLicitacion.nombre_licitacion;
    document.getElementById('modal-simulador').classList.remove('hidden');
    calculate();
}

function calculate() {
    const total = currentLicitacion.monto_adjudicado;
    const gastos = (Number(document.getElementById('gasto-medico').value) || 0) + (Number(document.getElementById('gasto-logistica').value) || 0);
    const utilidad = total - gastos;
    const perc = Math.round((utilidad / total) * 100);
    
    document.getElementById('sim-resultado').innerText = `$${utilidad.toLocaleString('es-CL')}`;
    const bar = document.getElementById('sim-bar');
    bar.style.width = `${Math.max(0, Math.min(perc, 100))}%`;
}

// FUNCIONES GENERALES
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function logout() { supabaseClient.auth.signOut().then(() => window.location.replace('login.html')); }
