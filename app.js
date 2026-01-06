// CONFIGURACIÓN DE SUPABASE (Usando tus credenciales)
const SB_URL = "https://ybwtjxgvicebwmyhkhda.supabase.co";
const SB_KEY = "sb_publishable_Ae-JOXtX_fLpFTMgne_4Sw_jiGrdCMp";
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

// VARIABLES GLOBALES
let licitacionesData = [];
let currentLicitacion = null;

// 1. INICIALIZACIÓN Y SEGURIDAD
document.addEventListener('DOMContentLoaded', async () => {
    // Verificar si el usuario está autenticado
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session) {
        // Si no hay sesión, redirigir al login
        window.location.href = 'login.html';
        return;
    }

    // Si hay sesión, mostrar el correo del usuario y cargar datos
    document.getElementById('user-name').innerText = session.user.email;
    fetchLicitaciones();
    
    // Inicializar iconos de Lucide
    lucide.createIcons();
});

// 2. OBTENER DATOS DE SUPABASE
async function fetchLicitaciones() {
    const { data, error } = await supabaseClient
        .from('licitaciones')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error al obtener licitaciones:", error.message);
        return;
    }

    licitacionesData = data;
    renderTable(data);
    updateKPIs(data);
}

// 3. ACTUALIZAR TARJETAS DE RESUMEN (KPIs)
function updateKPIs(data) {
    const totalAdjudicado = data
        .filter(item => item.status === 'Adjudicada')
        .reduce((sum, item) => sum + Number(item.monto_adjudicado), 0);

    document.getElementById('kpi-monto').innerText = `$${totalAdjudicado.toLocaleString('es-CL')}`;
    document.getElementById('kpi-count').innerText = data.length;
}

// 4. RENDERIZAR TABLA CON DISEÑO NIVEL PREMIUM
function renderTable(data) {
    const tableBody = document.getElementById('tender-table-body');
    tableBody.innerHTML = '';

    data.forEach(item => {
        // Colores dinámicos por estado
        let statusStyle = "";
        switch (item.status) {
            case 'Adjudicada': statusStyle = "bg-green-100 text-green-700 border-green-200"; break;
            case 'Pendiente': statusStyle = "bg-orange-100 text-orange-700 border-orange-200"; break;
            case 'No Adjudicada': statusStyle = "bg-red-100 text-red-700 border-red-200"; break;
            case 'Espera de Resolución': statusStyle = "bg-blue-100 text-blue-700 border-blue-200"; break;
            default: statusStyle = "bg-slate-100 text-slate-600 border-slate-200";
        }

        const row = document.createElement('tr');
        row.className = "group hover:bg-slate-50 transition-all border-b border-slate-100";
        row.innerHTML = `
            <td class="px-8 py-6">
                <p class="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">${item.nombre_licitacion}</p>
                <span class="text-[10px] text-slate-400 font-mono tracking-tighter">${item.codigo_id}</span>
            </td>
            <td class="px-8 py-6 text-sm font-semibold text-slate-600">
                <div class="flex items-center gap-2">
                    <i data-lucide="activity" class="w-4 h-4 text-slate-300"></i>
                    ${item.evaluacion}
                </div>
            </td>
            <td class="px-8 py-6 font-black text-slate-700">
                $${Number(item.monto_adjudicado).toLocaleString('es-CL')}
            </td>
            <td class="px-8 py-6">
                <span class="status-pill border ${statusStyle}">${item.status}</span>
            </td>
            <td class="px-8 py-6 text-center">
                <button onclick="openSimulador('${item.id}')" class="p-3 bg-slate-100 text-slate-500 hover:bg-[#0f172a] hover:text-white rounded-2xl transition-all shadow-sm">
                    <i data-lucide="calculator" class="w-5 h-5"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
    lucide.createIcons();
}

// 5. LÓGICA DEL SIMULADOR
function openSimulador(id) {
    currentLicitacion = licitacionesData.find(l => l.id === id);
    if (!currentLicitacion) return;

    document.getElementById('sim-nombre').innerText = currentLicitacion.nombre_licitacion;
    document.getElementById('modal-simulador').classList.remove('hidden');
    
    // Resetear inputs
    document.getElementById('gasto-medico').value = 0;
    document.getElementById('gasto-logistica').value = 0;
    document.getElementById('gasto-otros').value = 0;
    calculate();
}

function calculate() {
    const g1 = Number(document.getElementById('gasto-medico').value) || 0;
    const g2 = Number(document.getElementById('gasto-logistica').value) || 0;
    const g3 = Number(document.getElementById('gasto-otros').value) || 0;

    const totalGastos = g1 + g2 + g3;
    const utilidad = currentLicitacion.monto_adjudicado - totalGastos;
    const porcentaje = currentLicitacion.monto_adjudicado > 0 
        ? (utilidad / currentLicitacion.moutput_adjudicado) * 100 
        : 0;

    // Actualizar Interfaz
    const resDisplay = document.getElementById('sim-resultado');
    resDisplay.innerText = `$${utilidad.toLocaleString('es-CL')}`;
    
    // Cambiar color si hay pérdida
    resDisplay.className = utilidad < 0 ? "text-4xl font-black text-red-500" : "text-4xl font-black text-white";

    // Barra de progreso
    const bar = document.getElementById('sim-bar');
    const visualPercent = Math.max(0, Math.min(porcentaje, 100));
    bar.style.width = `${visualPercent}%`;
    
    // Color de barra según riesgo
    if (porcentaje < 15) bar.className = "bg-red-500 h-full transition-all duration-500";
    else if (porcentaje < 30) bar.className = "bg-yellow-500 h-full transition-all duration-500";
    else bar.className = "bg-green-500 h-full transition-all duration-500";
}

function closeModal() {
    document.getElementById('modal-simulador').classList.add('hidden');
}

// 6. CERRAR SESIÓN
async function logout() {
    const { error } = await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
}
