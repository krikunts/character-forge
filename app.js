const STORAGE_KEY = "character-forge-session-v1";
const THEME_KEY = "character-forge-theme";

const CATEGORY_META = {
  foundation: { label: "Основа", hint: "" },
  final: { label: "Финал", hint: "" },
  past: { label: "Прошлое", hint: "" },
  relationships: { label: "Отношения", hint: "" },
  habits: { label: "Привычки", hint: "" },
  quirks: { label: "Странности", hint: "" },
  world: { label: "Мир", hint: "" },
  rumors: { label: "Слухи", hint: "" }
};

const MODES = {
  standard: {
    label: "Стандарт",
    foundation: [
      "Происхождение / раса",
      "Пол",
      "Возраст",
      "Род занятий",
      "Внешность",
      "Отличительная черта",
      "Манера речи"
    ],
    final: ["Любимая цитата", "Что будет написано на надгробии", "Имя"],
    randomCount: 10,
    requirements: { past: 2, relationships: 2, habits: 2, quirks: 1, world: 1, rumors: 1 }
  },
  quick: {
    label: "Быстрая",
    foundation: ["Происхождение / раса", "Возраст", "Род занятий", "Внешность", "Отличительная черта"],
    final: ["Имя", "Что будет написано на надгробии"],
    randomCount: 5,
    requirements: { past: 1, relationships: 1, habits: 1, quirks: 1, world: 1 }
  },
  extended: {
    label: "Большая",
    foundation: [
      "Происхождение / раса",
      "Пол",
      "Возраст",
      "Род занятий",
      "Внешность",
      "Отличительная черта",
      "Манера речи"
    ],
    final: ["Любимая цитата", "Что будет написано на надгробии", "Имя"],
    randomCount: 20,
    requirements: { past: 4, relationships: 4, habits: 4, quirks: 3, world: 3, rumors: 2 }
  }
};

const appState = {
  questionBank: [],
  session: null,
  restoreAvailable: false
};

const nodes = {
  app: document.querySelector("#app"),
  setupScreen: document.querySelector("#setupScreen"),
  gameScreen: document.querySelector("#gameScreen"),
  resultScreen: document.querySelector("#resultScreen"),
  setupForm: document.querySelector("#setupForm"),
  restoreButton: document.querySelector("#restoreButton"),
  playersInput: document.querySelector("#playersInput"),
  answerForm: document.querySelector("#answerForm"),
  answerInput: document.querySelector("#answerInput"),
  skipButton: document.querySelector("#skipButton"),
  questionCounter: document.querySelector("#questionCounter"),
  progressFill: document.querySelector("#progressFill"),
  playerTurn: document.querySelector("#playerTurn"),
  questionCategory: document.querySelector("#questionCategory"),
  questionTitle: document.querySelector("#questionTitle"),
  questionHint: document.querySelector("#questionHint"),
  dossierList: document.querySelector("#dossierList"),
  saveSnapshotButton: document.querySelector("#saveSnapshotButton"),
  restartButton: document.querySelector("#restartButton"),
  resultName: document.querySelector("#resultName"),
  resultMode: document.querySelector("#resultMode"),
  resultPlayers: document.querySelector("#resultPlayers"),
  resultCard: document.querySelector("#resultCard"),
  resultBio: document.querySelector("#resultBio"),
  resultDossier: document.querySelector("#resultDossier"),
  playAgainButton: document.querySelector("#playAgainButton"),
  exportButtons: document.querySelectorAll("[data-export-format]"),
  themeToggle: document.querySelector("#themeToggle"),
  themeToggleValue: document.querySelector("#themeToggleValue"),
  dossierItemTemplate: document.querySelector("#dossierItemTemplate")
};

boot();

async function boot() {
  applyTheme(loadTheme());
  bindEvents();
  appState.questionBank = await loadQuestions();
  appState.restoreAvailable = Boolean(loadSession());
  nodes.restoreButton.hidden = !appState.restoreAvailable;
  registerServiceWorker();
}

function bindEvents() {
  nodes.setupForm.addEventListener("submit", handleStartGame);
  nodes.restoreButton.addEventListener("click", restoreGame);
  nodes.answerForm.addEventListener("submit", handleSubmitAnswer);
  nodes.skipButton.addEventListener("click", () => advanceTurn("", true));
  nodes.saveSnapshotButton.addEventListener("click", persistSession);
  nodes.restartButton.addEventListener("click", resetToSetup);
  nodes.playAgainButton.addEventListener("click", resetToSetup);
  nodes.themeToggle.addEventListener("click", toggleTheme);
  nodes.exportButtons.forEach((button) => button.addEventListener("click", handleExport));
}

async function loadQuestions() {
  try {
    const response = await fetch("./data/questions.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Failed to load questions:", error);
    return [];
  }
}

function handleStartGame(event) {
  event.preventDefault();

  const players = nodes.playersInput.value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (players.length === 0) {
    nodes.playersInput.focus();
    return;
  }

  const formData = new FormData(nodes.setupForm);
  const modeId = formData.get("mode");
  const mode = MODES[modeId];
  const questions = buildQuestionSet(mode, appState.questionBank);

  if (questions.length !== mode.foundation.length + mode.randomCount + mode.final.length) {
    window.alert("Не удалось загрузить полную колоду вопросов. Обновите страницу и начните партию заново.");
    return;
  }

  appState.session = {
    id: crypto.randomUUID(),
    status: "playing",
    modeId,
    players,
    questions,
    currentIndex: 0,
    answers: [],
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  persistSession();
  render();
}

function restoreGame() {
  const session = loadSession();
  if (!session) {
    nodes.restoreButton.hidden = true;
    return;
  }

  appState.session = session;
  render();
}

function buildQuestionSet(mode, questionBank) {
  const questions = [];

  mode.foundation.forEach((question) => {
    questions.push({
      id: slugify(`foundation-${question}`),
      category: "foundation",
      question,
      slot: "foundation"
    });
  });

  const usedQuestions = new Set();
  const randomCards = [];
  Object.entries(mode.requirements).forEach(([category, amount]) => {
    const pool = shuffle(questionBank.filter((item) => item.category === category && !usedQuestions.has(item.question)));
    pool.slice(0, amount).forEach((item) => {
      usedQuestions.add(item.question);
      randomCards.push({
        id: slugify(`${category}-${item.question}`),
        category: item.category,
        question: item.question,
        slot: "random"
      });
    });
  });

  const remainingPool = shuffle(questionBank.filter((item) => !usedQuestions.has(item.question)));
  while (randomCards.length < mode.randomCount && remainingPool.length > 0) {
    const item = remainingPool.shift();
    usedQuestions.add(item.question);
    randomCards.push({
      id: slugify(`${item.category}-${item.question}`),
      category: item.category,
      question: item.question,
      slot: "random"
    });
  }

  shuffle(randomCards).forEach((item) => questions.push(item));

  mode.final.forEach((question) => {
    questions.push({
      id: slugify(`final-${question}`),
      category: "final",
      question,
      slot: "final"
    });
  });

  return questions;
}

function handleSubmitAnswer(event) {
  event.preventDefault();
  const answer = nodes.answerInput.value.trim();
  if (!answer) {
    nodes.answerInput.focus();
    return;
  }

  advanceTurn(answer, false);
}

function advanceTurn(answer, skipped) {
  const session = appState.session;
  const question = session.questions[session.currentIndex];
  const playerIndex = session.currentIndex % session.players.length;

  session.answers.push({
    questionId: question.id,
    question: question.question,
    category: question.category,
    slot: question.slot,
    player: session.players[playerIndex],
    answer,
    skipped,
    answeredAt: new Date().toISOString()
  });

  session.currentIndex += 1;
  session.updatedAt = new Date().toISOString();

  if (session.currentIndex >= session.questions.length) {
    session.status = "complete";
    persistSession();
    renderResult();
    return;
  }

  persistSession();
  nodes.answerForm.reset();
  renderGame();
}

function render() {
  if (!appState.session) {
    showScreen("setup");
    return;
  }

  if (appState.session.status === "complete") {
    renderResult();
    return;
  }

  renderGame();
}

function renderGame() {
  const session = appState.session;
  const question = session.questions[session.currentIndex];
  const meta = CATEGORY_META[question.category];
  const player = session.players[session.currentIndex % session.players.length];
  const total = session.questions.length;
  const current = session.currentIndex + 1;

  showScreen("game");
  nodes.questionCounter.textContent = `Вопрос ${current} из ${total}`;
  nodes.progressFill.style.width = `${(current / total) * 100}%`;
  nodes.playerTurn.textContent = `Отвечает: ${player}`;
  nodes.questionCategory.textContent = meta.label;
  nodes.questionTitle.textContent = question.question;
  nodes.questionHint.textContent = meta.hint;
  nodes.questionHint.hidden = !meta.hint;
  renderDossier(nodes.dossierList, buildDossierEntries(session.answers));
  nodes.answerInput.focus();
}

function renderResult() {
  const session = appState.session;
  const dossier = buildDossierEntries(session.answers);
  const biography = buildBiography(dossier);
  const characterName = dossier["Имя"] || "Безымянный герой";

  showScreen("result");
  nodes.resultName.textContent = characterName;
  nodes.resultMode.textContent = MODES[session.modeId].label;
  nodes.resultPlayers.textContent = `${session.players.length} ${pluralizePlayers(session.players.length)}`;
  nodes.resultBio.textContent = biography;
  nodes.resultCard.replaceChildren(...buildResultCardNodes(dossier));
  renderDossier(nodes.resultDossier, dossier);
}

function showScreen(screen) {
  nodes.setupScreen.hidden = screen !== "setup";
  nodes.gameScreen.hidden = screen !== "game";
  nodes.resultScreen.hidden = screen !== "result";
}

function renderDossier(container, dossier) {
  container.replaceChildren();
  const entries = Array.isArray(dossier) ? dossier : Object.entries(dossier);

  if (entries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "question-card__hint";
    empty.textContent = "Досье заполнится по мере ответов.";
    container.append(empty);
    return;
  }

  entries.forEach(([label, value]) => {
    const fragment = nodes.dossierItemTemplate.content.cloneNode(true);
    fragment.querySelector("dt").textContent = label;
    fragment.querySelector("dd").textContent = value;
    container.append(fragment);
  });
}

function buildDossierEntries(answers) {
  const ordered = {};

  answers.forEach((entry) => {
    if (entry.skipped) {
      return;
    }
    ordered[entry.question] = entry.answer;
  });

  return ordered;
}

function buildResultCardNodes(dossier) {
  const importantFields = [
    "Имя",
    "Возраст",
    "Род занятий",
    "Происхождение / раса",
    "Внешность",
    "Отличительная черта",
    "Манера речи",
    "Любимая цитата"
  ];

  return importantFields
    .filter((key) => dossier[key])
    .map((key) => {
      const wrapper = document.createElement("div");
      wrapper.className = "result-kv";

      const title = document.createElement("strong");
      title.textContent = key;
      const value = document.createElement("span");
      value.textContent = dossier[key];

      wrapper.append(title, value);
      return wrapper;
    });
}

function buildBiography(dossier) {
  const name = dossier["Имя"] || "Этот персонаж";
  const age = dossier["Возраст"] ? `${dossier["Возраст"]}-летний` : "";
  const job = dossier["Род занятий"] || "герой";
  const trait = dossier["Отличительная черта"] || "запоминающейся манерой держаться";
  const home = dossier["Жилище"] || dossier["Любимое место"] || "где-то между слухами и воспоминаниями";
  const rumor = dossier["Какой слух о нём ходит"] || dossier["В какой истории никто не верит"] || "о нём всегда рассказывают лишнее";
  const secret = dossier["Тайна"] || dossier["Странный талант"] || dossier["Что прячет от гостей"] || "он явно знает больше, чем говорит";
  const quote = dossier["Любимая цитата"] || "у него всегда находится странно точная фраза";

  return `${name}, ${compact([age, job]).join(" ")} с ${trait}, живёт ${home}. ` +
    `О нём говорят, что ${lowercaseFirst(rumor)}, но сам он предпочитает вспоминать, как ${lowercaseFirst(secret)}. ` +
    `Если разговор затягивается, он обычно повторяет: ${quote}.`;
}

function persistSession() {
  if (!appState.session) {
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState.session));
  appState.restoreAvailable = true;
  nodes.restoreButton.hidden = false;
}

function loadSession() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function resetToSetup() {
  appState.session = null;
  appState.restoreAvailable = false;
  localStorage.removeItem(STORAGE_KEY);
  nodes.answerForm.reset();
  nodes.restoreButton.hidden = true;
  showScreen("setup");
}

function handleExport(event) {
  if (!appState.session || appState.session.status !== "complete") {
    return;
  }

  const format = event.currentTarget.dataset.exportFormat;
  const dossier = buildDossierEntries(appState.session.answers);
  const payload = createExportPayload(format, dossier);
  downloadFile(`character-forge-${slugify(dossier["Имя"] || "hero")}.${format}`, payload, mimeFor(format));
}

function createExportPayload(format, dossier) {
  const biography = buildBiography(dossier);
  const baseObject = {
    meta: {
      mode: MODES[appState.session.modeId].label,
      players: appState.session.players,
      totalQuestions: appState.session.questions.length
    },
    dossier,
    biography,
    answers: appState.session.answers
  };

  if (format === "json") {
    return JSON.stringify(baseObject, null, 2);
  }

  if (format === "md") {
    return [
      `# ${dossier["Имя"] || "Безымянный герой"}`,
      "",
      `**Режим:** ${MODES[appState.session.modeId].label}`,
      `**Игроки:** ${appState.session.players.join(", ")}`,
      "",
      "## Краткая биография",
      biography,
      "",
      "## Досье",
      ...Object.entries(dossier).map(([key, value]) => `- **${key}:** ${value}`)
    ].join("\n");
  }

  return [
    `Character Forge`,
    `Имя: ${dossier["Имя"] || "Безымянный герой"}`,
    `Режим: ${MODES[appState.session.modeId].label}`,
    `Игроки: ${appState.session.players.join(", ")}`,
    "",
    "Краткая биография:",
    biography,
    "",
    "Досье:",
    ...Object.entries(dossier).map(([key, value]) => `${key}: ${value}`)
  ].join("\n");
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js");
  }
}

function toggleTheme() {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
  localStorage.setItem(THEME_KEY, nextTheme);
}

function loadTheme() {
  return localStorage.getItem(THEME_KEY) || "dark";
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  nodes.themeToggleValue.textContent = theme === "dark" ? "Dark" : "Light";
}

function shuffle(array) {
  const clone = [...array];
  for (let index = clone.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [clone[index], clone[swapIndex]] = [clone[swapIndex], clone[index]];
  }
  return clone;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-zа-я0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "");
}

function lowercaseFirst(value) {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function compact(values) {
  return values.filter(Boolean);
}

function mimeFor(format) {
  return {
    txt: "text/plain;charset=utf-8",
    md: "text/markdown;charset=utf-8",
    json: "application/json;charset=utf-8"
  }[format];
}

function pluralizePlayers(count) {
  if (count % 10 === 1 && count % 100 !== 11) {
    return "игрок";
  }
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
    return "игрока";
  }
  return "игроков";
}
