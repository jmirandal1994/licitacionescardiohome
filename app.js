// CONFIGURACIÓN DE SUPABASE
const SUPABASE_URL = "https://ybwtjxgvicebwmyhkhda.supabase.co";
const SUPABASE_KEY = "sb_publishable_Ae-JOXtX_fLpFTMgne_4Sw_jiGrdCMp";
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// VARIABLES DE ESTADO
let licitaciones = [];

// INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', () => {
    checkUser();
    fetchLicitaciones();
    lucide.createIcons();
});

// 1. CONTROL DE NAVEGACIÓN (Funcionalidad de botones)
function showSection(sectionId) {
    // Aquí puedes ocultar/mostrar divs según el botón presionado
    console.log("Cambiando a sección:", sectionId);
    // Por ahora, refrescamos la lista si vuelve a dashboard
    if(sectionId === 'dashboard') fetchLicitaciones();
}

// 2. OBTENER DATOS DE SUPABASE
async function fetchLicitaciones() {
    const { data, error } = await supabase
        .from('licitaciones')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error cargando licitaciones:", error);
        return;
    }

    licitaciones = data;
    renderTable(data);
    updateKPIs(data);
}

// 3. RENDERIZAR TABLA CON COLORES PROFESIONALES
function renderTable(data) {
    const tableBody = document.getElementById('tender-table-body');
    tableBody.innerHTML = '';

    data.forEach(item => {
        const row = document.createElement('tr');
        row.className = "hover:bg-slate-50 transition";
        row.innerHTML = `
            <td class="px-6 py-4 font-medium">${item.nombre_licitacion} <br><span class="text-xs text-slate-400">${item.codigo_id}</span></td>
            <td class="px-6 py-4 text-sm">${item.evaluacion}</td>
            <td class="px-6 py-4 font-bold text-slate-700">$${item.monto_adjudicado.toLocaleString('es-CL')}</td>
            <td class="px-6 py-4">${getStatusBadge(item.status)}</td>
            <td class="px-6 py-4 text-center">
                <button onclick="openSimulador('${item.id}')" class="text-indigo-600 hover:text-indigo-900">
                    <i data-lucide="calculator" class="w-5 h-5"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
    lucide.createIcons();
}

// 4. LÓGICA DEL SIMULADOR (Cálculo de Margen)
function openSimulador(id) {
    const lic = licitaciones.find(l => l.id === id);
    document.getElementById('simulador-modal').classList.remove('hidden');
    document.getElementById('sim-nombre-lic').innerText = lic.nombre_licitacion;
    document.getElementById('sim-monto-total').innerText = `$${lic.monto_adjudicado.toLocaleString('es-CL')}`;
    
    // Almacenamos el monto para el cálculo en vivo
    window.currentMonto = lic.monto_adjudicado;
}

function calcularUtilidad() {
    const gastosInputs = document.querySelectorAll('#gastos-inputs input');
    let totalGastos = 0;
    gastosInputs.forEach(input => totalGastos += Number(input.value));

    const utilidad = window.currentMonto - totalGastos;
    const porcentaje = (utilidad / window.currentMonto) * 100;

    const display = document.getElementById('utilidad-final');
    display.innerText = `$${utilidad.toLocaleString('es-CL')}`;
    
    // Cambiar color si es pérdida
    display.className = utilidad < 0 ? "text-4xl font-black text-red-600" : "text-4xl font-black text-green-600";
    
    const bar = document.getElementById('utilidad-bar');
    bar.style.width = `${Math.max(0, Math.min(porcentaje, 100))}%`;
    bar.className = porcentaje < 20 ? "bg-red-500 h-full" : "bg-green-500 h-full";
}

// 5. CERRAR SESIÓN
async function logout() {
    await supabase.auth.signOut();
    window.location.href = 'login.html'; // Debes crear esta página
}
