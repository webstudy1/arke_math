const examSelect = document.getElementById("exam-select");
const scoreForm = document.getElementById("score-form");
const commonScoreInput = document.getElementById("common-score");
const electiveScoreInput = document.getElementById("elective-score");
const electiveScoreLabel = document.getElementById("elective-score-label");
const messageEl = document.getElementById("message");
const examInfoEl = document.getElementById("exam-info");
const resultCard = document.getElementById("result-card");
const topLinksCard = document.getElementById("top-links-card");
const topLinksEl = document.getElementById("top-links");

const resultExamName = document.getElementById("result-exam-name");
const resultRawScore = document.getElementById("result-raw-score");
const resultStandardScore = document.getElementById("result-standard-score");
const resultPercentile = document.getElementById("result-percentile");
const resultGrade = document.getElementById("result-grade");
const resultGradeText = document.getElementById("result-grade-text");
const resultCutoffs = document.getElementById("result-cutoffs");
const historyEmpty = document.getElementById("history-empty");
const historyContent = document.getElementById("history-content");
const historyChart = document.getElementById("history-chart");
const historyList = document.getElementById("history-list");
const clearHistoryButton = document.getElementById("clear-history");

let exams = [];
const historyStorageKey = "arkeScoreHistory";

const linkTypeLabels = {
  pdf: "PDF",
  video: "영상",
  answer: "문제지/정답",
  solution: "해설",
  form: "설문",
  notice: "공지",
  other: "링크"
};

document.addEventListener("DOMContentLoaded", init);
scoreForm.addEventListener("submit", handleSubmit);
examSelect.addEventListener("change", handleExamChange);
clearHistoryButton.addEventListener("click", clearHistory);
historyList.addEventListener("click", handleHistoryClick);
window.addEventListener("resize", renderHistory);

function init() {
  loadExams();
  renderHistory();
}

function setMessage(text) {
  messageEl.textContent = text || "";
}

function hideResult() {
  resultCard.classList.add("hidden");
}

async function loadExams() {
  try {
    const response = await fetch("exams.json");

    if (!response.ok) {
      throw new Error("시험 데이터를 불러오지 못했습니다.");
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("exams.json은 시험 데이터 배열이어야 합니다.");
    }

    exams = data;
    renderExamOptions(exams);
    setMessage("");
  } catch (error) {
    examSelect.innerHTML = '<option value="">시험 데이터를 불러올 수 없습니다</option>';
    examSelect.disabled = true;
    setMessage(error.message || "시험 데이터를 불러오지 못했습니다.");
  }
}

function renderExamOptions(examList) {
  examSelect.innerHTML = "";

  if (examList.length === 0) {
    examSelect.innerHTML = '<option value="">등록된 시험이 없습니다</option>';
    examSelect.disabled = true;
    return;
  }

  examList.forEach((exam) => {
    const option = document.createElement("option");
    option.value = exam.id;
    option.textContent = exam.name || exam.id;
    examSelect.appendChild(option);
  });

  examSelect.disabled = false;
  handleExamChange();
}

function handleExamChange() {
  hideResult();
  setMessage("");

  const exam = getSelectedExam();

  if (!exam) {
    examInfoEl.classList.add("hidden");
    topLinksCard.classList.add("hidden");
    electiveScoreLabel.textContent = "선택과목 점수";
    return;
  }

  electiveScoreLabel.textContent = `${exam.electiveName || "선택과목"} 점수`;
  commonScoreInput.placeholder = `0~${exam.commonMax}`;
  electiveScoreInput.placeholder = `0~${exam.electiveMax}`;
  commonScoreInput.max = exam.commonMax;
  electiveScoreInput.max = exam.electiveMax;
  renderTopLinks(exam.links);
  renderExamInfo(exam);
}

function getSelectedExam() {
  return exams.find((exam) => exam.id === examSelect.value);
}

function handleSubmit(event) {
  event.preventDefault();
  setMessage("");
  hideResult();

  const exam = getSelectedExam();

  if (!exam) {
    setMessage("시험을 선택해 주세요.");
    return;
  }

  const validationError = validateExam(exam);

  if (validationError) {
    setMessage(validationError);
    return;
  }

  const commonValue = commonScoreInput.value.trim();
  const electiveValue = electiveScoreInput.value.trim();

  if (commonValue === "" || electiveValue === "") {
    setMessage("공통 점수와 선택과목 점수를 모두 입력해 주세요.");
    return;
  }

  const commonScore = Number(commonValue);
  const electiveScore = Number(electiveValue);

  if (!Number.isFinite(commonScore) || !Number.isFinite(electiveScore)) {
    setMessage("점수는 숫자만 입력해 주세요.");
    return;
  }

  if (!Number.isInteger(commonScore) || !Number.isInteger(electiveScore)) {
    setMessage("점수는 정수로 입력해 주세요.");
    return;
  }

  if (commonScore < 0 || electiveScore < 0) {
    setMessage("점수는 음수로 입력할 수 없습니다.");
    return;
  }

  if (commonScore > exam.commonMax) {
    setMessage(`공통 점수는 ${exam.commonMax}점을 초과할 수 없습니다.`);
    return;
  }

  if (electiveScore > exam.electiveMax) {
    setMessage(`${exam.electiveName} 점수는 ${exam.electiveMax}점을 초과할 수 없습니다.`);
    return;
  }

  const rawScore = commonScore + electiveScore;
  const standardScore = calculateStandardScore(commonScore, electiveScore, exam);
  const zeroRawStandardScore = calculateStandardScore(0, 0, exam);
  const percentile = interpolatePercentile(standardScore, exam.percentileTable, zeroRawStandardScore);
  const grade = getGrade(standardScore, exam.cutoffs);

  renderResult({
    exam,
    rawScore,
    standardScore,
    percentile,
    grade,
    commonScore,
    electiveScore
  });
}

function validateExam(exam) {
  if (!exam || typeof exam !== "object") {
    return "시험 데이터 형식이 올바르지 않습니다.";
  }

  if (!exam.id || !exam.name) {
    return "시험 데이터에 id 또는 name이 없습니다.";
  }

  if (!Number.isFinite(Number(exam.commonMax)) || Number(exam.commonMax) < 0) {
    return `${exam.name}의 공통 만점 형식이 올바르지 않습니다.`;
  }

  if (!Number.isFinite(Number(exam.electiveMax)) || Number(exam.electiveMax) < 0) {
    return `${exam.name}의 선택과목 만점 형식이 올바르지 않습니다.`;
  }

  if (
    !exam.formula ||
    !Number.isFinite(Number(exam.formula.a)) ||
    !Number.isFinite(Number(exam.formula.b)) ||
    !Number.isFinite(Number(exam.formula.c))
  ) {
    return `${exam.name}의 표준점수 환산식 형식이 올바르지 않습니다.`;
  }

  if (
    !exam.cutoffs ||
    !Number.isFinite(Number(exam.cutoffs["1"])) ||
    !Number.isFinite(Number(exam.cutoffs["2"])) ||
    !Number.isFinite(Number(exam.cutoffs["3"]))
  ) {
    return `${exam.name}의 등급컷 형식이 올바르지 않습니다.`;
  }

  if (!Array.isArray(exam.percentileTable) || exam.percentileTable.length === 0) {
    return `${exam.name}의 백분위 대응표 형식이 올바르지 않습니다.`;
  }

  const hasInvalidPercentileRow = exam.percentileTable.some((row) => (
    !row ||
    !Number.isFinite(Number(row.standardScore)) ||
    !Number.isFinite(Number(row.percentile))
  ));

  if (hasInvalidPercentileRow) {
    return `${exam.name}의 백분위 대응표에 잘못된 값이 있습니다.`;
  }

  return "";
}

function calculateStandardScore(commonScore, electiveScore, exam) {
  const score =
    Number(exam.formula.a) * commonScore +
    Number(exam.formula.b) * electiveScore +
    Number(exam.formula.c);

  return Math.round(score);
}

function getGrade(standardScore, cutoffs) {
  if (standardScore >= Number(cutoffs["1"])) {
    return "1등급";
  }

  if (standardScore >= Number(cutoffs["2"])) {
    return "2등급";
  }

  if (standardScore >= Number(cutoffs["3"])) {
    return "3등급";
  }

  return "3등급 미만";
}

function interpolatePercentile(standardScore, percentileTable, zeroRawStandardScore = 0) {
  const sortedTable = percentileTable
    .map((row) => ({
      standardScore: Number(row.standardScore),
      percentile: Number(row.percentile)
    }))
    .sort((a, b) => a.standardScore - b.standardScore);

  const exactMatch = sortedTable.find((row) => row.standardScore === standardScore);

  if (exactMatch) {
    return clampPercentile(exactMatch.percentile);
  }

  const lowest = sortedTable[0];
  const highest = sortedTable[sortedTable.length - 1];

  if (standardScore > highest.standardScore) {
    return clampPercentile(highest.percentile);
  }

  if (standardScore < lowest.standardScore) {
    const baselineScore = Number(zeroRawStandardScore);

    if (!Number.isFinite(baselineScore) || baselineScore >= lowest.standardScore) {
      return standardScore <= lowest.standardScore ? 0 : clampPercentile(lowest.percentile);
    }

    if (standardScore <= baselineScore) {
      return 0;
    }

    const lowRatio = (standardScore - baselineScore) / (lowest.standardScore - baselineScore);
    const lowEstimate = lowRatio * lowest.percentile;
    return clampPercentile(lowEstimate);
  }

  for (let index = 0; index < sortedTable.length - 1; index += 1) {
    const lower = sortedTable[index];
    const upper = sortedTable[index + 1];

    if (standardScore > lower.standardScore && standardScore < upper.standardScore) {
      const ratio = (standardScore - lower.standardScore) / (upper.standardScore - lower.standardScore);
      const percentile = lower.percentile + ratio * (upper.percentile - lower.percentile);
      return clampPercentile(percentile);
    }
  }

  return 0;
}

function clampPercentile(value) {
  return Math.min(100, Math.max(0, value));
}

function renderResult(result) {
  resultExamName.textContent = result.exam.name;
  resultRawScore.textContent = `${formatNumber(result.rawScore)}점`;
  resultStandardScore.textContent = `${result.standardScore}점`;
  resultPercentile.textContent = result.percentile.toFixed(1);
  resultGrade.textContent = result.grade;
  resultGradeText.textContent = result.grade;
  resultCutoffs.innerHTML = renderCutoffs(result.exam.cutoffs);
  resultCard.classList.remove("hidden");
  saveHistory(result);
  renderHistory();
}

function getHistory() {
  try {
    const savedHistory = JSON.parse(localStorage.getItem(historyStorageKey) || "[]");

    if (!Array.isArray(savedHistory)) {
      return [];
    }

    return savedHistory.filter((item) => (
      item &&
      Number.isFinite(Number(item.standardScore)) &&
      Number.isFinite(Number(item.rawScore)) &&
      item.examName &&
      item.createdAt
    ));
  } catch (error) {
    return [];
  }
}

function saveHistory(result) {
  const history = getHistory();
  const nextItem = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    examId: result.exam.id,
    examName: result.exam.name,
    electiveName: result.exam.electiveName,
    commonScore: result.commonScore,
    electiveScore: result.electiveScore,
    rawScore: result.rawScore,
    standardScore: result.standardScore,
    percentile: Number(result.percentile.toFixed(1)),
    grade: result.grade
  };

  const nextHistory = [...history, nextItem].slice(-50);
  try {
    localStorage.setItem(historyStorageKey, JSON.stringify(nextHistory));
  } catch (error) {
    setMessage("브라우저 사이트 데이터 저장이 제한되어 기록을 저장하지 못했습니다.");
  }
}

function clearHistory() {
  try {
    localStorage.removeItem(historyStorageKey);
  } catch (error) {
    setMessage("브라우저 사이트 데이터에 접근할 수 없어 기록을 지우지 못했습니다.");
  }

  renderHistory();
}

function deleteHistoryItem(id) {
  const nextHistory = getHistory().filter((item) => item.id !== id);

  try {
    localStorage.setItem(historyStorageKey, JSON.stringify(nextHistory));
  } catch (error) {
    setMessage("브라우저 사이트 데이터에 접근할 수 없어 기록을 지우지 못했습니다.");
  }

  renderHistory();
}

function handleHistoryClick(event) {
  const deleteButton = event.target.closest("[data-delete-history]");

  if (!deleteButton) {
    return;
  }

  deleteHistoryItem(deleteButton.dataset.deleteHistory);
}

function renderHistory() {
  const history = getHistory();

  if (history.length === 0) {
    historyEmpty.classList.remove("hidden");
    historyContent.classList.add("hidden");
    historyList.innerHTML = "";
    clearHistoryButton.disabled = true;
    clearChart();
    return;
  }

  historyEmpty.classList.add("hidden");
  historyContent.classList.remove("hidden");
  clearHistoryButton.disabled = false;
  drawHistoryChart(history);
  renderHistoryList(history);
}

function drawHistoryChart(history) {
  const context = historyChart.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const displayWidth = Math.max(historyChart.parentElement.clientWidth, 520);
  const displayHeight = 280;

  historyChart.width = displayWidth * ratio;
  historyChart.height = displayHeight * ratio;
  historyChart.style.width = `${displayWidth}px`;
  historyChart.style.height = `${displayHeight}px`;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, displayWidth, displayHeight);

  const padding = {
    top: 24,
    right: 22,
    bottom: 42,
    left: 44
  };
  const chartWidth = displayWidth - padding.left - padding.right;
  const chartHeight = displayHeight - padding.top - padding.bottom;
  const scores = history.map((item) => Number(item.standardScore));
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const scoreRange = Math.max(1, maxScore - minScore);
  const yMin = Math.max(0, minScore - Math.ceil(scoreRange * 0.18));
  const yMax = maxScore + Math.ceil(scoreRange * 0.18);
  const yRange = Math.max(1, yMax - yMin);

  context.strokeStyle = "#d9e0ea";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(padding.left, padding.top);
  context.lineTo(padding.left, padding.top + chartHeight);
  context.lineTo(padding.left + chartWidth, padding.top + chartHeight);
  context.stroke();

  context.fillStyle = "#667085";
  context.font = "12px sans-serif";
  context.textAlign = "right";
  context.textBaseline = "middle";

  for (let index = 0; index <= 4; index += 1) {
    const tickValue = yMin + (yRange / 4) * index;
    const y = padding.top + chartHeight - ((tickValue - yMin) / yRange) * chartHeight;

    context.strokeStyle = "#edf1f6";
    context.beginPath();
    context.moveTo(padding.left, y);
    context.lineTo(padding.left + chartWidth, y);
    context.stroke();
    context.fillText(Math.round(tickValue), padding.left - 8, y);
  }

  const getX = (index) => {
    if (history.length === 1) {
      return padding.left + chartWidth / 2;
    }

    return padding.left + (chartWidth / (history.length - 1)) * index;
  };
  const getY = (score) => padding.top + chartHeight - ((score - yMin) / yRange) * chartHeight;

  context.strokeStyle = "#2563eb";
  context.lineWidth = 3;
  context.beginPath();

  history.forEach((item, index) => {
    const x = getX(index);
    const y = getY(Number(item.standardScore));

    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });

  context.stroke();

  history.forEach((item, index) => {
    const x = getX(index);
    const y = getY(Number(item.standardScore));
    const previous = history[index - 1];
    const diff = previous ? Number(item.standardScore) - Number(previous.standardScore) : 0;

    context.fillStyle = diff >= 0 ? "#16a34a" : "#dc2626";
    context.beginPath();
    context.arc(x, y, 5, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#172033";
    context.font = "12px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "bottom";
    context.fillText(String(item.standardScore), x, y - 9);
  });

  context.fillStyle = "#667085";
  context.font = "12px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "top";
  context.fillText("계산 순서", padding.left + chartWidth / 2, displayHeight - 24);
}

function clearChart() {
  const context = historyChart.getContext("2d");
  context.clearRect(0, 0, historyChart.width, historyChart.height);
}

function renderHistoryList(history) {
  const latestFirst = [...history].reverse();

  historyList.innerHTML = latestFirst.map((item, index) => {
    const previous = history[history.length - 2 - index];
    const diff = previous ? Number(item.standardScore) - Number(previous.standardScore) : 0;
    const diffText = previous ? formatDiff(diff) : "첫 기록";
    const diffClass = diff > 0 ? "up" : diff < 0 ? "down" : "same";

    return `
      <article class="history-item">
        <div>
          <strong>${escapeHtml(item.examName)}</strong>
          <p>${formatDateTime(item.createdAt)} · 원점수 ${formatNumber(item.rawScore)}점 · 표준점수 ${item.standardScore}점 · 백분위 ${Number(item.percentile).toFixed(1)} · ${escapeHtml(item.grade)}</p>
        </div>
        <div class="history-actions">
          <span class="diff-badge ${diffClass}">${diffText}</span>
          <button class="delete-history-button" type="button" data-delete-history="${escapeAttribute(item.id)}">삭제</button>
        </div>
      </article>
    `;
  }).join("");
}

function formatDiff(value) {
  if (value > 0) {
    return `+${value}점`;
  }

  if (value < 0) {
    return `${value}점`;
  }

  return "0점";
}

function formatDateTime(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function renderExamInfo(exam) {
  const validationError = validateExam(exam);

  if (validationError) {
    examInfoEl.innerHTML = `<div class="error-box">${escapeHtml(validationError)}</div>`;
    examInfoEl.classList.remove("hidden");
    return;
  }

  const notices = Array.isArray(exam.notices) && exam.notices.length > 0
    ? `<ul class="notice-list">${exam.notices.map((notice) => `<li>${escapeHtml(notice)}</li>`).join("")}</ul>`
    : '<p class="info-muted">등록된 안내문이 없습니다.</p>';

  examInfoEl.innerHTML = `
    <div class="card-header">
      <div>
        <p class="eyebrow">시험 선택 정보</p>
        <h2>${escapeHtml(exam.name)}</h2>
        <p>${escapeHtml(exam.description || "")}</p>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-box">
        <span>과목명</span>
        <strong>${escapeHtml(exam.subject || "-")}</strong>
      </div>
      <div class="info-box">
        <span>공통 만점</span>
        <strong>${formatNumber(exam.commonMax)}점</strong>
      </div>
      <div class="info-box">
        <span>선택과목명</span>
        <strong>${escapeHtml(exam.electiveName || "-")}</strong>
      </div>
      <div class="info-box">
        <span>선택과목 만점</span>
        <strong>${formatNumber(exam.electiveMax)}점</strong>
      </div>
      <div class="info-box">
        <span>표준점수 계산식</span>
        <strong>${escapeHtml(exam.formula.display || "등록된 표시식 없음")}</strong>
      </div>
      <div class="info-box">
        <span>1~3등급컷</span>
        <strong>1등급 ${exam.cutoffs["1"]}점 · 2등급 ${exam.cutoffs["2"]}점 · 3등급 ${exam.cutoffs["3"]}점</strong>
      </div>
    </div>

    <h3>시험별 안내</h3>
    ${notices}

  `;

  examInfoEl.classList.remove("hidden");
}

function renderTopLinks(links) {
  topLinksEl.innerHTML = renderLinks(links, true);
  topLinksCard.classList.remove("hidden");
}

function renderLinks(links, prominent = false) {
  if (!Array.isArray(links) || links.length === 0) {
    return '<p class="info-muted">등록된 관련 자료가 없습니다.</p>';
  }

  const linkItems = links
    .filter((link) => link && link.label && link.url)
    .map((link) => {
      const typeLabel = linkTypeLabels[link.type] || linkTypeLabels.other;
      const className = prominent ? "link-chip link-chip-prominent" : "link-chip";

      return `
        <a class="${className}" href="${escapeAttribute(link.url)}" target="_blank" rel="noopener noreferrer">
          <span class="link-type">${escapeHtml(typeLabel)}</span>
          ${escapeHtml(link.label)}
        </a>
      `;
    })
    .join("");

  if (!linkItems) {
    return '<p class="info-muted">등록된 관련 자료가 없습니다.</p>';
  }

  return `<div class="links">${linkItems}</div>`;
}

function renderCutoffs(cutoffs) {
  return ["1", "2", "3"].map((grade) => `
    <div class="cutoff-cell">
      <span>${grade}등급컷</span>
      <strong>${cutoffs[grade]}점</strong>
    </div>
  `).join("");
}

function formatNumber(value) {
  return Number(value).toLocaleString("ko-KR");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
