const form = document.getElementById('analysis-form');
const loading = document.getElementById('loading');
const summaryText = document.getElementById('summary-text');
const technologiesContainer = document.getElementById('technologies');
const keywordsContainer = document.getElementById('keywords');
const componentsList = document.getElementById('components');
const strengthsList = document.getElementById('strengths');
const limitationsList = document.getElementById('limitations');
const technicalChallengesList = document.getElementById('technicalChallenges');
const insightContainer = document.getElementById('insight-container');
const reportContainer = document.getElementById('report-container');
const downloadButton = document.getElementById('download-pdf');
const newAnalysisButton = document.getElementById('new-analysis');
const searchButton = document.getElementById('searchButton');
const searchQueryInput = document.getElementById('searchQuery');
const searchResultsContainer = document.getElementById('searchResults');
const historyList = document.getElementById('history-list');
const clearHistoryButton = document.getElementById('clear-history');

let currentProjectId = null;
const HISTORY_KEY = 'my-tech-research-history';

function getHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch (error) {
    console.error('분석 히스토리를 읽지 못했습니다.', error);
    return [];
  }
}

function saveHistory(data) {
  const historyItem = {
    id: data.project?.id || crypto.randomUUID(),
    savedAt: new Date().toISOString(),
    project: data.project,
    analysis: data.analysis,
    insight: data.insight,
    report: data.report,
  };
  const history = [historyItem, ...getHistory().filter((item) => item.id !== historyItem.id)].slice(0, 20);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  const history = getHistory();
  historyList.innerHTML = '';

  if (!history.length) {
    historyList.innerHTML = '<p class="empty-state">저장된 분석이 없습니다.</p>';
    return;
  }

  history.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'history-item';

    const details = document.createElement('div');
    const title = document.createElement('p');
    title.className = 'history-item-title';
    title.textContent = item.project?.name || '이름 없는 분석';
    const meta = document.createElement('p');
    meta.className = 'history-item-meta';
    meta.textContent = new Date(item.savedAt).toLocaleString('ko-KR');
    details.append(title, meta);

    const openButton = document.createElement('button');
    openButton.type = 'button';
    openButton.className = 'secondary-btn small-btn';
    openButton.textContent = '열기';
    openButton.addEventListener('click', () => {
      currentProjectId = item.project?.id || item.id;
      renderAnalysis(item);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    row.append(details, openButton);
    historyList.appendChild(row);
  });
}

function setLoading(isLoading) {
  loading.classList.toggle('hidden', !isLoading);
}

function renderChips(container, items) {
  container.innerHTML = '';
  items.forEach((item) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = item;
    container.appendChild(chip);
  });
}

function renderList(listEl, items) {
  listEl.innerHTML = '';
  items.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    listEl.appendChild(li);
  });
}

function renderSearchResults(data) {
  const results = data?.results || [];
  searchResultsContainer.innerHTML = '';

  if (!results.length) {
    searchResultsContainer.innerHTML = '<p>검색 결과가 없습니다.</p>';
    return;
  }

  results.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'search-item';

    const link = document.createElement('a');
    link.href = item.url || '#';
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = item.title || '검색 결과';

    const snippet = document.createElement('p');
    snippet.textContent = item.snippet || '';

    card.appendChild(link);
    card.appendChild(snippet);
    searchResultsContainer.appendChild(card);
  });
}

async function runSearch() {
  const query = searchQueryInput.value.trim();
  if (!query) {
    alert('검색어를 입력해 주세요.');
    return;
  }

  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) {
      throw new Error('검색 요청에 실패했습니다.');
    }

    const data = await response.json();
    renderSearchResults(data);
  } catch (error) {
    console.error(error);
    searchResultsContainer.innerHTML = `<p>검색 중 오류가 발생했습니다: ${error.message}</p>`;
  }
}

function renderAnalysis(data) {
  const { analysis, insight, report } = data;

  summaryText.textContent = analysis.summary;
  renderChips(technologiesContainer, analysis.technologies.map((tech) => tech.name));
  renderChips(keywordsContainer, analysis.keywords);
  renderList(componentsList, analysis.components);
  renderList(strengthsList, analysis.strengths);
  renderList(limitationsList, analysis.limitations);
  renderList(technicalChallengesList, analysis.technicalChallenges);

  insightContainer.innerHTML = '';
  const insightGroups = [
    { title: '01. 기술 동향', items: insight.trends },
    { title: '02. 기술 격차', items: insight.technologyGaps },
    { title: '03. 핵심 R&D 과제', items: insight.researchTopics },
    { title: '04. 기술적 기회', items: insight.futureDirections.map((item) => ({ title: item, description: item })) },
    { title: '05. 리스크', items: insight.risks.map((item) => ({ title: item, description: item })) },
  ];

  insightGroups.forEach((group) => {
    const box = document.createElement('div');
    box.className = 'insight-group';

    const title = document.createElement('h3');
    title.textContent = group.title;
    box.appendChild(title);

    if (group.items.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = '분석 결과가 없습니다.';
      box.appendChild(empty);
    } else {
      if (group.title.includes('기술 동향') || group.title.includes('기술 격차') || group.title.includes('핵심 R&D 과제')) {
        const list = document.createElement('ul');
        group.items.forEach((item) => {
          const li = document.createElement('li');
          if (item.title) {
            li.innerHTML = `<strong>${item.title}</strong> - ${item.description || item.reason || item.gap || ''}`;
          } else {
            li.textContent = item;
          }
          list.appendChild(li);
        });
        box.appendChild(list);
      } else {
        const list = document.createElement('ul');
        group.items.forEach((item) => {
          const li = document.createElement('li');
          li.textContent = typeof item === 'string' ? item : item.title || item.description;
          list.appendChild(li);
        });
        box.appendChild(list);
      }
    }

    insightContainer.appendChild(box);
  });

  reportContainer.innerHTML = '';
  const list = document.createElement('ul');
  list.className = 'report-list';
  report.sections.forEach((section) => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${section.title}</strong><br>${(section.content || []).join('<br>')}`;
    list.appendChild(li);
  });
  reportContainer.appendChild(list);

  if (data.project?.id) {
    currentProjectId = data.project.id;
  }
}

renderHistory();

searchButton.addEventListener('click', runSearch);
searchQueryInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    runSearch();
  }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setLoading(true);

  const formData = new FormData(form);
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('분석 요청에 실패했습니다.');
    }

    const data = await response.json();
    renderAnalysis(data);
    saveHistory(data);
  } catch (error) {
    summaryText.textContent = error.message;
    console.error(error);
  } finally {
    setLoading(false);
  }
});

downloadButton.addEventListener('click', async () => {
  if (!currentProjectId) {
    alert('먼저 분석을 실행해 주세요.');
    return;
  }

  window.location.href = `/api/projects/${currentProjectId}/report.pdf`;
});

newAnalysisButton.addEventListener('click', () => {
  form.reset();
  document.querySelector('input[name="analysisMode"][value="summary"]').checked = true;
  document.getElementById('projectName').value = '차세대 배터리 기술 분석';
  document.getElementById('purpose').value = '최근 기술 동향과 향후 R&D 방향 파악';
  summaryText.textContent = '분석을 시작하면 핵심 요약이 표시됩니다.';
  technologiesContainer.innerHTML = '';
  keywordsContainer.innerHTML = '';
  componentsList.innerHTML = '';
  strengthsList.innerHTML = '';
  limitationsList.innerHTML = '';
  technicalChallengesList.innerHTML = '';
  insightContainer.innerHTML = '';
  reportContainer.innerHTML = '';
  currentProjectId = null;
});

clearHistoryButton.addEventListener('click', () => {
  if (!getHistory().length) {
    return;
  }

  if (confirm('저장된 분석 히스토리를 모두 삭제할까요?')) {
    localStorage.removeItem(HISTORY_KEY);
    renderHistory();
  }
});
