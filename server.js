const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const PDFDocument = require('pdfkit');
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const upload = multer({ storage: multer.memoryStorage() });
const projects = new Map();

function buildOpenAIRequestPayload(input) {
  const payload = input && input.project ? input : { project: input, documents: input?.documents || [] };
  const project = payload.project || { name: '새 기술 분석 프로젝트', purpose: '기술 동향 분석' };
  const documents = payload.documents || [];
  const text = documents
    .map((doc) => `${doc.fileName}\n${(doc.extractedText || '').slice(0, 1500)}`)
    .join('\n---\n');

  return {
    model: 'gpt-4o-mini',
    temperature: 0.5,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'You are an expert R&D analyst. Return valid JSON only. Use the fields: summary, technologies, keywords, components, strengths, limitations, technicalChallenges, sources. Keep all values as JSON arrays or strings, no markdown.',
      },
      {
        role: 'user',
        content: `Project name: ${project.name}\nPurpose: ${project.purpose}\nData:\n${text}`,
      },
    ],
  };
}

function parseOpenAIResponse(rawContent) {
  const content = String(rawContent || '').trim();
  if (!content) {
    throw new Error('OpenAI returned an empty response.');
  }

  let cleaned = content;
  const fencedMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch) {
    cleaned = fencedMatch[1].trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw error;
  }
}

function sha(text) {
  return crypto.createHash('sha256').update(String(text || '')).digest('hex').slice(0, 12);
}

function createProject(projectName, purpose, analysisMode) {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: projectName,
    purpose,
    analysisMode,
    createdAt: now,
    updatedAt: now,
    documents: [],
    analysis: null,
    insight: null,
    report: null,
  };
}

async function extractDocumentText(file) {
  const extension = path.extname(file.originalname).toLowerCase();

  if (extension === '.pdf') {
    const parsed = await pdfParse(file.buffer);
    return parsed.text || '';
  }

  if (extension === '.txt') {
    return file.buffer.toString('utf8');
  }

  if (extension === '.docx') {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return result.value || '';
  }

  return '';
}

function generateSummary(projectName, purpose, documents) {
  const combinedText = documents.map((doc) => doc.extractedText).join('\n');
  const keywordList = ['전고체', '배터리', '전해질', '리튬', '에너지 밀도'];
  const usedKeywords = keywordList.filter((keyword) => combinedText.toLowerCase().includes(keyword.toLowerCase()));

  return `${projectName}와 관련된 자료를 검토한 결과, ${purpose} 관점에서 기술적 핵심은 ${usedKeywords.length ? usedKeywords.slice(0, 3).join(', ') : '기술 성능 및 구조 안정성'}에 집중되고 있다. 문서 전반에서는 소재 조성, 전극 구조, 전해질 안정성, 시스템 통합이 핵심 변수로 나타났으며, 기술 실현을 위해서는 성능 향상과 안전성 확보를 동시에 달성해야 한다.`;
}

function buildAnalysis(project, documents) {
  const text = documents.map((doc) => doc.extractedText).join('\n');
  const lower = text.toLowerCase();

  const technologies = [
    {
      name: '전고체 전해질',
      description: '기존 액체 전해질의 한계를 보완하는 고체 기반 전해질 구조로, 열 안정성과 내구성이 핵심 이점으로 제시된다.',
      importance: '전지 안전성, 고온 안정성, 에너지 밀도 개선과 직접 연결되는 핵심 기술로 평가된다.',
    },
    {
      name: '리튬 금속 음극',
      description: '에너지 밀도를 높이는 데 유리한 구조로, 고용량 전극 설계와 결합된 차세대 배터리 핵심 요소다.',
      importance: '배터리 용량 증가를 위해 필수적인 기술이며, 안정성 확보와 함께 R&D의 중심 축이다.',
    },
    {
      name: '분리막 및 계면 제어',
      description: '전극과 전해질 사이의 계면 제어와 이온 이동 경로 최적화를 통해 성능과 안정성을 균형 있게 유지한다.',
      importance: '나노 구조화 기술과 계면 안정화 기술이 결합될 때 성능 향상 효과가 크게 나타난다.',
    },
  ].filter((item) => lower.includes(item.name.split(' ')[0].slice(0, 2)) || ['배터리', '전해질', '리튬', '에너지'].some((keyword) => lower.includes(keyword)));

  const normalizedTechnologies = technologies.length
    ? technologies
    : [
        {
          name: '차세대 배터리 시스템',
          description: '성능 향상과 안전성을 동시에 달성하는 차세대 배터리 구조를 의미한다.',
          importance: '기술의 방향성과 실용성을 결정하는 핵심 축이다.',
        },
      ];

  return {
    summary: generateSummary(project.name, project.purpose, documents),
    technologies: normalizedTechnologies,
    keywords: ['배터리', '전고체', '전해질', '리튬', '에너지 밀도', '안전성'],
    components: ['소재', '전극', '전해질', '계면', '셀 구조', '시스템 통합'],
    strengths: [
      '에너지 밀도 향상 가능성',
      '안전성 개선 잠재력',
      '고온 환경 적응성',
    ],
    limitations: [
      '실제 대량 생산 기준의 비용 부담',
      '계면 안정성 확보의 어려움',
      '장기 내구성 검증 미흡',
    ],
    technicalChallenges: [
      '대량 생산을 위한 공정 안정화',
      '내부 응력 제어 기술',
      '배터리 수명과 용량 간 균형 확보',
    ],
    sources: documents.slice(0, 3).map((doc, index) => ({
      document: doc.fileName,
      page: index + 1,
      claim: `${doc.fileName}에서 확인된 핵심 내용은 기술 성능과 안정성의 개선 경로와 밀접하게 연계된다.`,
    })),
  };
}

function buildInsight(analysis) {
  return {
    trends: [
      {
        title: '고체 기반 구조로의 전환 가속',
        description: '기술 자료 전반에서 액체 전해질 대비 고체 전해질 기반 구조가 안전성과 고온 안정성 측면에서 유리하다는 평가가 반복된다.',
        evidence: ['전고체 전해질', '안전성', '고온 대응'],
      },
      {
        title: '시스템 설계보다 재료·계면 최적화가 핵심',
        description: '재료의 물성 제어와 계면 안정성 확보가 실질적 성능 향상의 관건으로 부각되고 있다.',
        evidence: ['계면', '분리막', '무기/유기 조합'],
      },
    ],
    technologyGaps: [
      {
        current: '현재 기술은 특정 성능 향상과 안전성 개선에 집중된 수준이다.',
        target: '목표는 대량 생산 기반의 장기 안정성과 경제성을 동시에 확보하는 것이다.',
        gap: '산업 현실화 단계에서 비용 효율성과 장기 내구성 사이의 안정적 균형이 부족하다.',
      },
    ],
    researchTopics: [
      {
        title: '계면 안정화 기술 고도화',
        reason: '배터리 성능과 수명에 직접적인 영향을 주기 때문에 우선적 투자 대상이다.',
        difficulty: '중간',
      },
      {
        title: '대량 생산용 공정 개발',
        reason: '실제 상용화로 이어지려면 생산성 확보가 필수적이다.',
        difficulty: '높음',
      },
    ],
    futureDirections: [
      '고체 전해질 기반 구조를 중심으로 안전성 강화와 고에너지 밀도 구현',
      '소재·계면·공정의 통합 설계로 제조 비용 절감',
      '실제 환경 조건을 반영한 장기 성능 검증 체계 구축',
    ],
    risks: [
      '재료 고가와 대량 생산 비용 상승',
      '계면 변화로 인한 성능 저하',
      '규제 대응 및 안전 기준 강화',
    ],
  };
}

function buildReport(project, analysis, insight) {
  return {
    title: `${project.name} R&D 기술 분석 보고서`,
    sections: [
      { title: '1. 분석 개요', content: [project.purpose, `분석 모드: ${project.analysisMode}`, `요약: ${analysis.summary}`] },
      { title: '2. 기술 개요', content: analysis.technologies.map((tech) => `${tech.name}: ${tech.description}`) },
      { title: '3. 핵심 기술', content: analysis.technologies.map((tech) => `- ${tech.name} (${tech.importance})`) },
      { title: '4. 기술 구조', content: analysis.components },
      { title: '5. 기술 동향', content: insight.trends.map((trend) => `${trend.title}: ${trend.description}`) },
      { title: '6. 기술 비교', content: ['핵심 기술 간 성능·안전성·경제성 비교가 필요하다.', '기존 기술 대비 향상 폭과 한계 요소를 동시 검토하여야 한다.'] },
      { title: '7. 기술 격차', content: insight.technologyGaps.map((gap) => `${gap.current} → ${gap.target} / ${gap.gap}`) },
      { title: '8. 주요 R&D 과제', content: insight.researchTopics.map((topic) => `- ${topic.title}: ${topic.reason}`) },
      { title: '9. 미래 발전 방향', content: insight.futureDirections },
      { title: '10. 기술적 리스크', content: insight.risks },
      { title: '11. R&D 인사이트', content: ['기술 리스크 관리, 제조 공정 최적화, 안전성 검증 체계가 핵심이다.'] },
      { title: '12. 결론', content: ['기술 전략은 단순 성능 개선이 아니라 상용화 지점에서의 안전성과 경제성을 동시에 확보하는 방향으로 설계되어야 한다.'] },
      { title: '13. 참고자료', content: analysis.sources.map((source) => `${source.document} / p.${source.page} / ${source.claim}`) },
    ],
  };
}

async function searchWeb(query = 'battery technology trends') {
  const key = process.env.BING_SEARCH_API_KEY;
  const endpoint = process.env.BING_SEARCH_ENDPOINT || 'https://api.bing.microsoft.com/v7.0/search';

  if (key) {
    try {
      const url = new URL(endpoint);
      url.searchParams.set('q', query);
      url.searchParams.set('count', '5');

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Ocp-Apim-Subscription-Key': key,
        },
      });

      if (response.ok) {
        const payload = await response.json();
        const results = (payload.webPages?.value || []).map((item) => ({
          title: item.name,
          url: item.url,
          snippet: item.snippet || '검색 결과 설명입니다.',
        }));

        if (results.length > 0) {
          return { source: 'Bing Search API', results };
        }
      }
    } catch (error) {
      console.warn('Bing Search failed, falling back to mock results:', error.message);
    }
  }

  const fallback = [
    {
      title: `${query} 최신 기술 동향 요약`,
      url: 'https://example.com/search/technology-trend',
      snippet: `${query} 관련 최신 연구와 산업 동향을 확인할 수 있는 요약 자료입니다.`,
    },
    {
      title: `${query} 실증 사례 및 상용화 이슈`,
      url: 'https://example.com/search/real-world-case',
      snippet: `${query} 분야의 실증 사례와 상용화 과정에서 발생하는 기술적 제약을 비교 분석한 자료입니다.`,
    },
    {
      title: `${query} R&D 과제 및 시장 전망`,
      url: 'https://example.com/search/rnd-roadmap',
      snippet: `${query} 기술의 개발 난이도, 투자 우선순위, 미래 시장 전망을 정리한 리포트입니다.`,
    },
  ];

  return { source: 'local-fallback', results: fallback };
}

async function callOpenAIIfConfigured(project, documents) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(buildOpenAIRequestPayload({ project, documents })),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
    }

    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content || '{}';
    const parsed = parseOpenAIResponse(content);

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('OpenAI response was not a JSON object.');
    }

    return parsed;
  } catch (error) {
    console.warn('OpenAI unavailable, using local generator:', error.message);
    return null;
  }
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/projects', (_req, res) => {
  res.json(Array.from(projects.values()));
});

app.get('/api/projects/:id', (req, res) => {
  const project = projects.get(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  res.json(project);
});

app.get('/api/search', async (req, res) => {
  const query = String(req.query.q || 'battery technology trends').trim();
  if (!query) {
    return res.status(400).json({ error: '검색어가 필요합니다.' });
  }

  const data = await searchWeb(query);
  res.json(data);
});

app.post('/api/projects', (req, res) => {
  const { projectName, purpose, analysisMode } = req.body || {};
  const project = createProject(projectName || '새 기술 분석 프로젝트', purpose || '기술 동향 분석', analysisMode || 'summary');
  projects.set(project.id, project);
  res.status(201).json(project);
});

app.post('/api/analyze', upload.array('files', 10), async (req, res) => {
  try {
    const projectName = req.body.projectName || '새 기술 분석 프로젝트';
    const purpose = req.body.purpose || '기술 동향 및 R&D 방향 파악';
    const analysisMode = req.body.analysisMode || 'summary';

    const project = createProject(projectName, purpose, analysisMode);

    const uploadedFiles = req.files || [];
    const documents = [];

    for (const file of uploadedFiles) {
      const extractedText = await extractDocumentText(file);
      documents.push({
        id: crypto.randomUUID(),
        fileName: file.originalname,
        fileType: path.extname(file.originalname).slice(1).toUpperCase(),
        extractedText,
        pageCount: Math.max(1, Math.ceil((extractedText.match(/\n/g) || []).length / 40) + 1),
        uploadedAt: new Date().toISOString(),
      });
    }

    const aiResult = (await callOpenAIIfConfigured(project, documents)) || null;
    const analysis = aiResult ? {
      ...buildAnalysis(project, documents),
      ...aiResult,
      sources: aiResult.sources || buildAnalysis(project, documents).sources,
    } : buildAnalysis(project, documents);

    const insight = buildInsight(analysis);
    const report = buildReport(project, analysis, insight);

    project.documents = documents;
    project.analysis = analysis;
    project.insight = insight;
    project.report = report;
    project.updatedAt = new Date().toISOString();

    projects.set(project.id, project);

    res.json({ project, analysis, insight, report });
  } catch (error) {
    console.error('Analyze failed', error);
    res.status(500).json({ error: '분석 중 오류가 발생했습니다.', details: error.message });
  }
});

app.get('/api/projects/:id/report.pdf', (req, res) => {
  const project = projects.get(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const report = project.report || buildReport(project, project.analysis || buildAnalysis(project, project.documents || []), project.insight || buildInsight(project.analysis || buildAnalysis(project, project.documents || [])));

  const doc = new PDFDocument({ margin: 50 });
  const safeName = (project.name || 'report').replace(/[^a-zA-Z0-9가-힣_\- ]/g, '').trim().replace(/\s+/g, '_');

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`);

  doc.pipe(res);
  doc.fontSize(22).text(report.title || 'R&D 기술 분석 보고서', { align: 'center' });
  doc.moveDown();

  report.sections.forEach((section) => {
    doc.fontSize(16).text(section.title);
    doc.moveDown(0.5);
    doc.fontSize(11);

    const lines = Array.isArray(section.content) ? section.content : [section.content];
    lines.forEach((line) => {
      doc.text(String(line), { align: 'left' });
    });

    doc.moveDown();
  });

  doc.end();
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`My Tech Research MVP running on http://localhost:${PORT}`);
  });
}

module.exports = Object.assign(app, {
  app,
  buildOpenAIRequestPayload,
  parseOpenAIResponse,
  callOpenAIIfConfigured,
  searchWeb,
});
