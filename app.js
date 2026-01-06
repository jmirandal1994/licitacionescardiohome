// CONFIGURACIÓN DE STORAGE
let currentBucket = 'documentos';
let currentPath = '';

// NAVEGACIÓN DE VISTAS
function showView(viewName) {
    const dashboard = document.getElementById('view-dashboard');
    const storage = document.getElementById('view-storage');
    const title = document.getElementById('display-view-name');

    // Resetear vistas
    dashboard.classList.add('hidden-view');
    storage.classList.add('hidden-view');

    if(viewName === 'dashboard') {
        dashboard.classList.remove('hidden-view');
        title.innerText = "Dashboard";
    } else {
        storage.classList.remove('hidden-view');
        currentPath = viewName.replace('storage-', '');
        title.innerText = viewName.replace('storage-', 'Repositorio: ').toUpperCase();
        loadFiles();
    }
}

// CARGAR ARCHIVOS DESDE SUPABASE
async function loadFiles() {
    const listContainer = document.getElementById('file-list');
    listContainer.innerHTML = '<p class="text-slate-400">Cargando archivos...</p>';

    const { data, error } = await supabaseClient
        .storage
        .from(currentBucket)
        .list(currentPath);

    if (error) return console.error(error);

    listContainer.innerHTML = '';
    data.forEach(file => {
        const card = document.createElement('div');
        card.className = "bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between group hover:border-indigo-500 transition";
        card.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center">
                    <i data-lucide="file-text"></i>
                </div>
                <div>
                    <p class="font-bold text-slate-800 text-sm truncate w-40">${file.name}</p>
                    <p class="text-[10px] text-slate-400 uppercase">Documento PDF</p>
                </div>
            </div>
            <button onclick="downloadFile('${file.name}')" class="text-slate-400 hover:text-indigo-600 transition">
                <i data-lucide="download"></i>
            </button>
        `;
        listContainer.appendChild(card);
    });
    lucide.createIcons();
}

// SUBIR ARCHIVO PDF
async function uploadFile() {
    const fileInput = document.getElementById('file-upload');
    const file = fileInput.files[0];
    if (!file) return;

    const filePath = `${currentPath}/${Date.now()}_${file.name}`;

    const { error } = await supabaseClient
        .storage
        .from(currentBucket)
        .upload(filePath, file);

    if (error) {
        alert("Error al subir archivo");
    } else {
        alert("Archivo subido con éxito");
        loadFiles();
    }
}

// DESCARGAR ARCHIVO PDF
async function downloadFile(fileName) {
    const { data, error } = await supabaseClient
        .storage
        .from(currentBucket)
        .download(`${currentPath}/${fileName}`);

    if (error) return console.error(error);

    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
}
