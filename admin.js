// admin.js - Painel Administrativo EBD Fiel

const ADMIN_PASSWORD_KEY = "ebd_admin_password";
const DEFAULT_PASSWORD = "4141";
const STORAGE_KEYS = {
  LESSONS: "ebd_lessons_data",
  ADMIN_OVERRIDES: "ebd_admin_overrides",
  CONTENT_OVERRIDES: "ebd_content_overrides",
  SETTINGS: "ebd_settings"
};

let currentLessons = { adult: [], youth: [] };
let adminOverrides = {};
let contentOverrides = {};
let settings = {};

// Inicialização
document.addEventListener("DOMContentLoaded", async () => {
  // Verificar autenticação
  if (!checkAuth()) {
    promptPassword();
    return;
  }
  
  await loadData();
  setupEventListeners();
  renderLessonsTable();
  updateStats();
  loadTrimesters();
  loadSettings();
});

// Autenticação
function checkAuth() {
  const savedPassword = localStorage.getItem(ADMIN_PASSWORD_KEY);
  return savedPassword === DEFAULT_PASSWORD || savedPassword === prompt("Digite a senha:");
}

function promptPassword() {
  const password = prompt("🔒 Acesso Restrito\n\nDigite a senha do painel administrativo:");
  if (password === DEFAULT_PASSWORD) {
    localStorage.setItem(ADMIN_PASSWORD_KEY, password);
    location.reload();
  } else if (password !== null) {
    alert("Senha incorreta!");
    window.location.href = "./index.html";
  } else {
    window.location.href = "./index.html";
  }
}

function logout() {
  localStorage.removeItem(ADMIN_PASSWORD_KEY);
  window.location.href = "./index.html";
}

// Carregar dados
async function loadData() {
  try {
    const response = await fetch("./lessons.json");
    const data = await response.json();
    currentLessons = data;
    
    // Carregar overrides
    const storedAdmin = localStorage.getItem(STORAGE_KEYS.ADMIN_OVERRIDES);
    const storedContent = localStorage.getItem(STORAGE_KEYS.CONTENT_OVERRIDES);
    
    if (storedAdmin) adminOverrides = JSON.parse(storedAdmin);
    if (storedContent) contentOverrides = JSON.parse(storedContent);
    
  } catch (error) {
    console.error("Erro ao carregar dados:", error);
    alert("Erro ao carregar as lições. Verifique o arquivo lessons.json");
  }
}

// Salvar overrides
function saveOverrides() {
  localStorage.setItem(STORAGE_KEYS.ADMIN_OVERRIDES, JSON.stringify(adminOverrides));
  localStorage.setItem(STORAGE_KEYS.CONTENT_OVERRIDES, JSON.stringify(contentOverrides));
}

// Renderizar tabela de lições
function renderLessonsTable() {
  const tbody = document.getElementById("lessonsTableBody");
  const filterClass = document.getElementById("filterClass").value;
  const filterTrimester = document.getElementById("filterTrimester").value;
  const filterStatus = document.getElementById("filterStatus").value;
  
  let allLessons = [];
  
  // Combinar todas as lições
  currentLessons.adult.forEach(l => allLessons.push({ ...l, tipo: "adult", classeNome: "Adultos" }));
  currentLessons.youth.forEach(l => allLessons.push({ ...l, tipo: "youth", classeNome: "Jovens" }));
  
  // Aplicar filtros
  let filtered = allLessons.filter(lesson => {
    if (filterClass !== "all" && lesson.tipo !== filterClass) return false;
    if (filterTrimester !== "all" && String(lesson.trimestre) !== filterTrimester) return false;
    
    const isAvailable = checkAvailability(lesson);
    if (filterStatus === "available" && !isAvailable) return false;
    if (filterStatus === "blocked" && isAvailable) return false;
    
    return true;
  });
  
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="loading-row">Nenhuma lição encontrada</td></tr>';
    return;
  }
  
  tbody.innerHTML = filtered.map(lesson => {
    const isAvailable = checkAvailability(lesson);
    const finalTitle = getFinalTitle(lesson);
    
    return `
      <tr>
        <td><strong>${lesson.classeNome}</strong></td>
        <td>${lesson.trimestre}º</td>
        <td>${String(lesson.numero).padStart(2, "0")}</td>
        <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis;">${finalTitle}</td>
        <td>${lesson.data || "—"}</td>
        <td>
          <span class="status-badge ${isAvailable ? 'status-available' : 'status-blocked'}">
            <i class="fas ${isAvailable ? 'fa-check-circle' : 'fa-lock'}"></i>
            ${isAvailable ? 'Disponível' : 'Bloqueada'}
          </span>
        </td>
        <td>
          <div class="action-buttons">
            <button class="action-btn edit-btn" data-id="${lesson.id}" data-tipo="${lesson.tipo}" data-trimestre="${lesson.trimestre}" data-numero="${lesson.numero}">
              <i class="fas fa-edit"></i> Editar
            </button>
            <button class="action-btn toggle-btn ${isAvailable ? 'available' : ''}" data-id="${lesson.id}" data-tipo="${lesson.tipo}">
              <i class="fas ${isAvailable ? 'fa-lock' : 'fa-unlock-alt'}"></i>
              ${isAvailable ? 'Bloquear' : 'Liberar'}
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
  
  // Adicionar event listeners
  document.querySelectorAll(".edit-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = parseInt(btn.dataset.id);
      const tipo = btn.dataset.tipo;
      const lesson = allLessons.find(l => l.id === id && l.tipo === tipo);
      if (lesson) openEditModal(lesson);
    });
  });
  
  document.querySelectorAll(".toggle-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = parseInt(btn.dataset.id);
      const tipo = btn.dataset.tipo;
      const key = `${tipo}:${id}`;
      adminOverrides[key] = !adminOverrides[key];
      saveOverrides();
      renderLessonsTable();
      updateStats();
    });
  });
}

// Verificar disponibilidade
function checkAvailability(lesson) {
  const key = `${lesson.tipo}:${lesson.id}`;
  if (adminOverrides.hasOwnProperty(key)) return adminOverrides[key];
  
  if (!lesson.data) return true;
  const [day, month, year] = lesson.data.split("/");
  const lessonDate = new Date(Number(year), Number(month) - 1, Number(day));
  const releaseDate = new Date(lessonDate);
  releaseDate.setDate(lessonDate.getDate() - 6);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today >= releaseDate;
}

// Obter título final (com overrides)
function getFinalTitle(lesson) {
  const key = `${lesson.tipo}:${lesson.id}`;
  if (contentOverrides[key]?.titulo) return contentOverrides[key].titulo;
  return lesson.titulo;
}

// Abrir modal de edição
function openEditModal(lesson) {
  const modal = document.getElementById("editLessonModal");
  const titleInput = document.getElementById("editLessonTitle");
  const dateInput = document.getElementById("editLessonDate");
  const contentTextarea = document.getElementById("editLessonContent");
  const previewDiv = document.getElementById("previewContent");
  
  const key = `${lesson.tipo}:${lesson.id}`;
  const savedContent = contentOverrides[key]?.conteudo;
  const savedTitle = contentOverrides[key]?.titulo;
  
  titleInput.value = savedTitle || lesson.titulo;
  dateInput.value = lesson.data || "";
  contentTextarea.value = savedContent || lesson.conteudo || "";
  previewDiv.innerHTML = savedContent || lesson.conteudo || "<p>Sem conteúdo</p>";
  
  modal.style.display = "flex";
  
  // Salvar
  document.getElementById("saveLessonBtn").onclick = () => {
    const newTitle = titleInput.value.trim();
    const newDate = dateInput.value.trim();
    const newContent = contentTextarea.value;
    
    if (!newTitle) {
      alert("O título é obrigatório!");
      return;
    }
    
    if (!newContent) {
      alert("O conteúdo é obrigatório!");
      return;
    }
    
    if (!contentOverrides[key]) contentOverrides[key] = {};
    contentOverrides[key].titulo = newTitle;
    contentOverrides[key].conteudo = newContent;
    
    // Atualizar data se mudou
    if (newDate && newDate !== lesson.data) {
      if (lesson.tipo === "adult") {
        const idx = currentLessons.adult.findIndex(l => l.id === lesson.id);
        if (idx !== -1) currentLessons.adult[idx].data = newDate;
      } else {
        const idx = currentLessons.youth.findIndex(l => l.id === lesson.id);
        if (idx !== -1) currentLessons.youth[idx].data = newDate;
      }
    }
    
    saveOverrides();
    renderLessonsTable();
    updateStats();
    modal.style.display = "none";
    alert("✅ Lição salva com sucesso!");
  };
  
  // Formatador rápido
  document.getElementById("formatHtmlBtn").onclick = () => {
    const rawText = contentTextarea.value;
    const formatted = formatMarkdownToHtml(rawText);
    contentTextarea.value = formatted;
    previewDiv.innerHTML = formatted;
  };
  
  // Preview ao digitar
  contentTextarea.oninput = () => {
    previewDiv.innerHTML = contentTextarea.value;
  };
}

// Formatador Markdown para HTML
function formatMarkdownToHtml(text) {
  let result = text;
  
  // Títulos
  result = result.replace(/^# (.*)$/gm, '<h1>$1</h1>');
  result = result.replace(/^## (.*)$/gm, '<h2>$1</h2>');
  result = result.replace(/^### (.*)$/gm, '<h3>$1</h3>');
  
  // Negrito e itálico
  result = result.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Listas
  result = result.replace(/^- (.*)$/gm, '<li>$1</li>');
  result = result.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
  
  // Parágrafos
  result = result.replace(/^(?!<[^>]+>)(.*)$/gm, '<p>$1</p>');
  
  // Limpar parágrafos vazios
  result = result.replace(/<p>\s*<\/p>/g, '');
  
  return result;
}

// Atualizar estatísticas
function updateStats() {
  let total = 0;
  let available = 0;
  
  const allLessons = [...currentLessons.adult, ...currentLessons.youth];
  total = allLessons.length;
  available = allLessons.filter(l => checkAvailability(l)).length;
  
  const trimestres = new Set();
  allLessons.forEach(l => trimestres.add(l.trimestre));
  
  document.getElementById("totalLessons").textContent = total;
  document.getElementById("totalTrimesters").textContent = trimestres.size;
  document.getElementById("availableLessons").textContent = available;
}

// Carregar trimestres
function loadTrimesters() {
  const container = document.getElementById("trimestersList");
  const allLessons = [...currentLessons.adult, ...currentLessons.youth];
  const classes = ["adult", "youth"];
  const classNames = { adult: "Adultos", youth: "Jovens" };
  
  let html = "";
  
  classes.forEach(classe => {
    const lessons = allLessons.filter(l => l.tipo === classe);
    const trimestres = [...new Set(lessons.map(l => l.trimestre))].sort();
    
    trimestres.forEach(trim => {
      const lessonsInTrim = lessons.filter(l => l.trimestre === trim);
      const availableCount = lessonsInTrim.filter(l => checkAvailability(l)).length;
      
      html += `
        <div class="trimester-card">
          <h4><i class="fas fa-calendar"></i> ${classNames[classe]} - ${trim}º Trimestre</h4>
          <p><strong>Lições:</strong> ${lessonsInTrim.length} (${availableCount} disponíveis)</p>
          <button class="btn-secondary unlock-trimester" data-classe="${classe}" data-trimestre="${trim}" style="margin-top: 12px; width: 100%;">
            <i class="fas fa-unlock-alt"></i> Liberar todas
          </button>
        </div>
      `;
    });
  });
  
  container.innerHTML = html || "<p>Nenhum trimestre encontrado</p>";
  
  document.querySelectorAll(".unlock-trimester").forEach(btn => {
    btn.addEventListener("click", () => {
      const classe = btn.dataset.classe;
      const trimestre = parseInt(btn.dataset.trimestre);
      const lessons = allLessons.filter(l => l.tipo === classe && l.trimestre === trimestre);
      lessons.forEach(lesson => {
        const key = `${lesson.tipo}:${lesson.id}`;
        adminOverrides[key] = true;
      });
      saveOverrides();
      renderLessonsTable();
      updateStats();
      loadTrimesters();
      alert(`✅ Todas as lições do ${trimestre}º trimestre de ${classe === "adult" ? "Adultos" : "Jovens"} foram liberadas!`);
    });
  });
}

// Carregar configurações
function loadSettings() {
  const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
  if (saved) {
    settings = JSON.parse(saved);
    applySettings();
  }
}

function saveSettings() {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

function applySettings() {
  if (settings.primaryColor) {
    document.documentElement.style.setProperty('--primary', settings.primaryColor);
  }
}

// Event listeners
function setupEventListeners() {
  // Logout
  document.getElementById("logoutBtn")?.addEventListener("click", logout);
  
  // Tabs
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`tab${btn.dataset.tab.charAt(0).toUpperCase() + btn.dataset.tab.slice(1)}`).classList.add("active");
    });
  });
  
  // Filtros
  document.getElementById("filterClass")?.addEventListener("change", () => renderLessonsTable());
  document.getElementById("filterTrimester")?.addEventListener("change", () => renderLessonsTable());
  document.getElementById("filterStatus")?.addEventListener("change", () => renderLessonsTable());
  
  // Ações em massa
  document.getElementById("unlockAllBtn")?.addEventListener("click", () => {
    if (confirm("Liberar TODAS as lições?")) {
      const allLessons = [...currentLessons.adult, ...currentLessons.youth];
      allLessons.forEach(lesson => {
        const key = `${lesson.tipo}:${lesson.id}`;
        adminOverrides[key] = true;
      });
      saveOverrides();
      renderLessonsTable();
      updateStats();
      loadTrimesters();
      alert("✅ Todas as lições foram liberadas!");
    }
  });
  
  document.getElementById("blockAllBtn")?.addEventListener("click", () => {
    if (confirm("Bloquear TODAS as lições?")) {
      const allLessons = [...currentLessons.adult, ...currentLessons.youth];
      allLessons.forEach(lesson => {
        const key = `${lesson.tipo}:${lesson.id}`;
        adminOverrides[key] = false;
      });
      saveOverrides();
      renderLessonsTable();
      updateStats();
      loadTrimesters();
      alert("🔒 Todas as lições foram bloqueadas!");
    }
  });
  
  // Vídeos
  document.getElementById("saveVideosBtn")?.addEventListener("click", () => {
    const adultVideo = document.getElementById("adultVideoId").value;
    const youthVideo = document.getElementById("youthVideoId").value;
    settings.videos = { adult: adultVideo, youth: youthVideo };
    saveSettings();
    alert("✅ Vídeos salvos! Eles serão aplicados na página inicial.");
  });
  
  // Senha
  document.getElementById("changePasswordBtn")?.addEventListener("click", () => {
    const newPassword = document.getElementById("adminPassword").value;
    if (newPassword && newPassword.length >= 4) {
      localStorage.setItem(ADMIN_PASSWORD_KEY, newPassword);
      alert("✅ Senha alterada com sucesso!");
      document.getElementById("adminPassword").value = "";
    } else {
      alert("A senha deve ter pelo menos 4 caracteres.");
    }
  });
  
  // Aparência
  document.getElementById("saveAppearanceBtn")?.addEventListener("click", () => {
    settings.primaryColor = document.getElementById("primaryColor").value;
    settings.secondaryColor = document.getElementById("secondaryColor").value;
    saveSettings();
    applySettings();
    alert("✅ Aparência salva!");
  });
  
  // Redes sociais
  document.getElementById("saveSocialBtn")?.addEventListener("click", () => {
    settings.social = {
      instagram: document.getElementById("socialInstagram").value,
      facebook: document.getElementById("socialFacebook").value,
      youtube: document.getElementById("socialYoutube").value,
      tiktok: document.getElementById("socialTiktok").value
    };
    saveSettings();
    alert("✅ Redes sociais salvas!");
  });
  
  // Exportar
  document.getElementById("exportDataBtn")?.addEventListener("click", () => {
    const exportData = {
      lessons: currentLessons,
      adminOverrides: adminOverrides,
      contentOverrides: contentOverrides,
      settings: settings
    };
    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ebd_fiel_backup_${new Date().toISOString().slice(0, 19)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
  
  // Importar
  document.getElementById("importDataBtn")?.addEventListener("click", () => {
    document.getElementById("importFile").click();
  });
  
  document.getElementById("importFile")?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.lessons) currentLessons = data.lessons;
        if (data.adminOverrides) adminOverrides = data.adminOverrides;
        if (data.contentOverrides) contentOverrides = data.contentOverrides;
        if (data.settings) settings = data.settings;
        
        saveOverrides();
        saveSettings();
        renderLessonsTable();
        updateStats();
        loadTrimesters();
        alert("✅ Dados importados com sucesso!");
      } catch (err) {
        alert("Erro ao importar arquivo. Verifique o formato.");
      }
    };
    reader.readAsText(file);
  });
  
  // Reset
  document.getElementById("resetAllBtn")?.addEventListener("click", () => {
    if (confirm("⚠️ ISSO APAGARÁ TODOS OS DADOS!\n\nTodas as edições, overrides e configurações serão perdidas.\n\nDeseja continuar?")) {
      localStorage.clear();
      alert("✅ Todos os dados foram resetados. A página será recarregada.");
      window.location.reload();
    }
  });
  
  // Limpar cache
  document.getElementById("clearCacheBtn")?.addEventListener("click", () => {
    if (confirm("Limpar o cache do navegador? Isso pode resolver problemas de exibição.")) {
      if ("caches" in window) {
        caches.keys().then(keys => {
          keys.forEach(key => caches.delete(key));
        });
      }
      alert("✅ Cache limpo! Recarregue a página (F5).");
    }
  });
  
  // Fechar modais
  document.querySelectorAll(".modal-close").forEach(btn => {
    btn.addEventListener("click", () => {
      document.getElementById("editLessonModal").style.display = "none";
      document.getElementById("addTrimesterModal").style.display = "none";
    });
  });
  
  window.onclick = (e) => {
    if (e.target.classList.contains("modal")) {
      e.target.style.display = "none";
    }
  };
}