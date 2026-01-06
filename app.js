const SB_URL = "https://ybwtjxgvicebwmyhkhda.supabase.co";
const SB_KEY = "sb_publishable_Ae-JOXtX_fLpFTMgne_4Sw_jiGrdCMp";
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

let licitacionesData = [];
let currentLicitacion = null;

// INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.href = 'login.html'; return; }
    
    fetchLicitaciones();
    lucide.createIcons();
});

// NAVEGACIÓN ENTRE VISTAS
function nav(section) {
    document.querySelectorAll('.view-content').forEach(v => v.classList.add('hidden'));
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    
    document.getElementById(`view-${section}`).classList.remove('hidden');
    document.getElementById(`btn-${section}`).classList.add('active');
    document.getElementById('page-title').innerText = section === 'dashboard' ? 'Dashboard General' : 'Repositorio Documental';
}

// OBTENER DATOS
async function fetchLicitaciones() {
    const { data, error } = await supabaseClient.from('licitaciones').select('*').order('created_at', { ascending: false });
    if (error) return;
    licitacionesData = data;
    renderTable(data);
    updateKPIs(data);
}

function updateKPIs(data) {
    const total = data.filter(i => i.status === 'Adjudicada').reduce((s, i) => s + Number(i.monto_adjudicado), 0);
    document.getElementById('kpi-monto').innerText = `$${total.toLocaleString('es-CL')}`;
    document.getElementById('kpi-count').innerText = data.length;
}

function renderTable(data) {
    const tableBody = document.getElementById('tender-table-body');
    tableBody.innerHTML = '';
    data.forEach(item => {
        const color = item.status === 'Adjudicada' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-orange-100 text-orange-700 border-orange-200';
        const row = document.createElement('tr');
        row.className = "hover:bg-slate-50 transition-all";
        row.innerHTML = `
            <td class="px-8 py-5 font-bold text-slate-800">${item.nombre_licitacion}<br><span class="text-[10px] text-slate-400 font-mono">${item.codigo_id}</span></td>
            <td class="px-8 py-5 text-sm">${item.evaluacion}</td>
            <td class="px-8 py-5 font-black">$${Number(item.monto_adjudicado).toLocaleString('es-CL')}</td>
            <td class="px-8 py-5"><span class="status-pill border ${color}">${item.status}</span></td>
            <td class="px-8 py-5 text-center"><button onclick="openSimulador('${item.id}')" class="p-2 bg-slate-100 rounded-lg hover:bg-slate-900 hover:text-white transition-all"><i data-lucide="calculator" class="w-4 h-4"></i></button></td>
        `;
        tableBody.appendChild(row);
    });
    lucide.createIcons();
}

// FORMULARIO NUEVA LICITACIÓN
function openNewModal() { document.getElementById('modal-nueva-licitacion').classList.remove('hidden'); }
function closeNewModal() { document.getElementById('modal-nueva-licitacion').classList.add('hidden'); }

document.getElementById('form-licitacion').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nueva = {
        nombre_licitacion: document.getElementById('add-nombre').value,
        codigo_id: document.getElementById('add-id').value,
        monto_adjudicado: Number(document.getElementById('add-monto').value),
        evaluacion: document.getElementById('add-evaluacion').value,
        status: document.getElementById('add-status').value
    };
    const { error } = await supabaseClient.from('licitaciones').insert([nueva]);
    if (!error) { closeNewModal(); fetchLicitaciones(); document.getElementById('form-licitacion').reset(); }
});

// SIMULADOR
function openSimulador(id) {
    currentLicitacion = licitacionesData.find(l => l.id === id);
    document.getElementById('sim-nombre').innerText = currentLicitacion.nombre_licitacion;
    document.getElementById('modal-simulador').classList.remove('hidden');
    calculate();
}

function calculate() {
    const gastos = (Number(document.getElementById('gasto-medico').value) || 0) + 
                   (Number(document.getElementById('gasto-logistica').value) || 0) + 
                   (Number(document.getElementById('gasto-otros').value) || 0);
    const utilidad = currentLicitacion.monto_adjudicado - gastos;
    const perc = (utilidad / currentLicitacion.monto_adjudicado) * 100;
    document.getElementById('sim-resultado').innerText = `$${utilidad.toLocaleString('es-CL')}`;
    document.getElementById('sim-bar').style.width = `${Math.max(0, Math.min(perc, 100))}%`;
}

function closeModal() { document.getElementById('modal-simulador').classList.add('hidden'); }
function logout() { supabaseClient.auth.signOut().then(() => location.href='login.html'); }
