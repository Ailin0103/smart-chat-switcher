/* Pure routing logic: replace classify() to add embeddings or an LLM later. */
(function (root) {
  const projects = [];
  const legacyPresetProjects = [
    {id:'job',name:'Job Search',purpose:'Career applications and resume work.',keywords:['resume','cover letter','job search','interview']},
    {id:'paper',name:'Paper 2',purpose:'Research on the second academic paper.',keywords:['paper 2','random matrix','lyapunov','non-adherence']},
    {id:'codon',name:'CodonBERT',purpose:'Research and development related to CodonBERT.',keywords:['codonbert','codon','protein','tokenization']},
    {id:'chubby',name:'Chubby Group',purpose:'Work related to the Chubby Group.',keywords:['chubby group','chubby']},
    {id:'thesis',name:'Dissertation',purpose:'Work on the dissertation and defense.',keywords:['dissertation','thesis','defense']}
  ];
  const PROTOCOL_SCHEMA = 1;
  const PROTOCOL_TOKEN = 'scr-route';
  const CONFIG_VERSION = '1.2';
  const defaults = {enabled: true, autoRoute: false, includeContext: true, configVersion: CONFIG_VERSION, projects};
  const normalize = s => String(s).normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
  function safeURL(value) {
    try {
      const u = new URL(value);
      if (u.origin !== 'https://chatgpt.com' || u.username || u.password || u.search || u.hash) return null;
      if (!/^\/(?:c\/[\w-]+|g\/[\w-]+\/project|g\/[\w-]+\/c\/[\w-]+)\/?$/.test(u.pathname)) return null;
      return u.origin + u.pathname.replace(/\/$/, '');
    } catch { return null; }
  }
  function matches(text, term) {
    const needle = normalize(term);
    if (!needle) return false;
    if (/^[\x00-\x7F]+$/.test(needle)) {
      const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp('(?:^|[^a-z0-9])' + escaped + '(?=$|[^a-z0-9])', 'i').test(text);
    }
    return text.includes(needle);
  }
  function classify(message, list, currentURL) {
    const text = normalize(message);
    const ranked = list.filter(p => p.active && p.discoveryStatus !== 'needs_confirmation' && safeURL(p.url)).map(p => {
      const hits = [...new Set(p.keywords.map(normalize).filter(Boolean))].filter(k => matches(text, k));
      const explicit = matches(text, p.name);
      return {project: p, hits, score: explicit ? 4 + hits.length : hits.length};
    }).sort((a, b) => b.score - a.score);
    const best = ranked[0];
    if (!best || !best.score) return {level: 'low', confidence: 0};
    if (safeURL(currentURL) === safeURL(best.project.url)) return {level: 'low', confidence: 1, reason: 'Already in this context'};
    // Scores are heuristic strengths, not calibrated probabilities. Ambiguity never auto-routes.
    const ambiguous = ranked[1]?.score > 0;
    const confidence = ambiguous ? 0.7 : best.score >= 2 ? 0.95 : 0.75;
    return {...best, confidence, level: confidence >= 0.9 ? 'high' : 'medium'};
  }
  const HANDOFF_LIMIT = 30000;
  function createReferenceHandoff({currentRequest, source, destination, id, referenceEnabled = true}) {
    if (typeof currentRequest !== 'string' || currentRequest.length > HANDOFF_LIMIT) throw Error('Current request is too large to hand off.');
    const title = typeof source?.title === 'string' ? source.title.trim() : '';
    const text = referenceEnabled && title
      ? [
          'Source conversation: "' + title.replace(/"/g, '\\"') + '"',
          '',
          'Please find and consult that conversation if it is accessible to you, and use the relevant context to continue with the request below. If you cannot identify or access it, say so and ask me for the necessary context. Do not fabricate its contents.',
          '',
          'Current request:',
          currentRequest
        ].join('\n')
      : 'Current request:\n' + currentRequest;
    if (text.length > HANDOFF_LIMIT) throw Error('Handoff is too large. The original request remains in the source composer.');
    return {version:'1.0', id, source, destination, current_request:currentRequest, reference_enabled:referenceEnabled, text};
  }
  function migrateSettings(settings) {
    const input = settings && typeof settings === 'object' ? settings : {};
    const sourceProjects = Array.isArray(input.projects) ? input.projects : [];
    const migratedProjects = sourceProjects.map((project, index) => ({
      ...project,
      id: typeof project.id === 'string' && project.id ? project.id : 'legacy-' + index,
      name: typeof project.name === 'string' ? project.name : '',
      purpose: typeof project.purpose === 'string' ? project.purpose : '',
      keywords: Array.isArray(project.keywords) ? project.keywords.filter(keyword => typeof keyword === 'string') : [],
      url: typeof project.url === 'string' ? project.url : '',
      active: project.active !== false
    })).filter(project => {
      const preset = legacyPresetProjects.find(item => item.id === project.id);
      if (!preset || project.url || project.name !== preset.name) return true;
      const keywords = [...new Set(project.keywords.map(normalize))].sort();
      const unchangedPurpose = !project.purpose || project.purpose === preset.purpose;
      return !unchangedPurpose || JSON.stringify(keywords) !== JSON.stringify([...preset.keywords].map(normalize).sort());
    });
    return {
      ...defaults,
      ...input,
      autoRoute: false,
      configVersion: CONFIG_VERSION,
      projects: migratedProjects
    };
  }
  function createActivationPrompt() {
    return `Help me set up Smart Chat Switcher using what you already know about my own ongoing projects.

Please identify my recurring projects and workstreams from the conversation context, saved memory, and any other information genuinely available to you. Do not ask me to prepare a Project list first.

The goal is to help me continue future conversations in the right existing ChatGPT Project.

For each project you can identify:

- Use its actual ChatGPT Project name if you know it.
- If you know the ongoing workstream but cannot verify its ChatGPT folder name, use a descriptive name and mark it as "needs_confirmation".
- Write one concise sentence describing what belongs in that project, specific to my work.
- Include up to eight supporting keywords or phrases.
- In this JSON, put each keyword or phrase in its own string in the supporting_keywords array; do not combine them into one comma-separated string. If I enter keywords manually in Settings instead of importing this JSON, I must separate each entry with a comma (for example: resume, CV, interview).
- Choose keywords in the languages I commonly use, based on the available context. If I use more than one language, include natural keywords in each relevant language so the Project can match when I switch languages.
- Include the actual terms, synonyms, and informal phrases I use when discussing that topic, not only formal labels or the Project name. For example, for a resume workstream, consider terms such as "resume", "CV", "简历", or "求职材料" when they fit my language and usage.
- Include the exact Project URL only if it is genuinely available. Otherwise leave it empty.
Focus on ongoing or recurring work. Do not turn every one-off question into a project. Do not invent activity, folder names, or URLs.

Distinguish between:

- "confirmed": Available information explicitly identifies this as one of my ChatGPT Projects and establishes its name.
- "needs_confirmation": You recognize this as my ongoing work, but cannot verify the actual ChatGPT Project name or whether a matching folder exists.
“Confirmed” does not mean that you have checked the URL or access permissions.

Return one valid JSON object using this structure:

{
  "schema": "scr-project-discovery-v1",
  "projects": [
    {
      "name": "<known Project name or descriptive workstream name>",
      "purpose": "<a concise description specific to my work>",
      "supporting_keywords": ["<relevant keyword or phrase>"],
      "url": "",
      "status": "confirmed",
      "basis": "<brief explanation of what available information supports this entry>"
    }
  ],
  "limitations": []
}

Use only the two allowed status values: "confirmed" and "needs_confirmation".

In limitations, briefly state any relevant gaps, such as being unable to inspect my complete Project list or retrieve exact URLs.

If you have no usable information about my projects, return an empty projects array and explain that in limitations. Do not generate generic sample projects.

Do not update memory or activate routing yet. This step only prepares a proposal for me to review in the extension.

Output JSON only, without Markdown fences or additional commentary.`;
  }
  function validateRegistryImport(raw, currentProjects) {
    let imported;
    try { imported = typeof raw === 'string' ? JSON.parse(raw) : raw; }
    catch { throw Error('The registry must be valid JSON.'); }
    if (!imported || Object.keys(imported).sort().join(',') !== ['limitations','projects','schema'].join(',') || imported.schema !== 'scr-project-discovery-v1' || !Array.isArray(imported.projects) || !Array.isArray(imported.limitations) || imported.limitations.length > 30 || imported.limitations.some(item => typeof item !== 'string' || item.length > 1000)) {
      throw Error('Expected a scr-project-discovery-v1 JSON object with projects and limitations arrays. Copy the Project discovery prompt and try again.');
    }
    if (!imported.projects.length) return {projects:currentProjects, limitations:imported.limitations, hasUpdates:false};
    const currentByName = new Map();
    for (const project of currentProjects) {
      const key = normalize(project.name);
      if (!currentByName.has(key)) currentByName.set(key, []);
      currentByName.get(key).push(project);
    }
    const seen = new Set();
    const updates = new Map(currentProjects.map(project => [project.id, project]));
    const added = [];
    for (const candidate of imported.projects) {
      if (!candidate || typeof candidate.name !== 'string' || !candidate.name.trim() || candidate.name.length > 160 || typeof candidate.url !== 'string') throw Error('Every proposed Project needs a valid name and URL field.');
      if (Object.keys(candidate).sort().join(',') !== ['basis','name','purpose','status','supporting_keywords','url'].join(',')) throw Error('Each Project must contain exactly name, purpose, supporting_keywords, url, status, and basis.');
      const key = normalize(candidate.name);
      if (seen.has(key)) throw Error('The registry contains a duplicate Project name: ' + candidate.name);
      seen.add(key);
      if (!['confirmed','needs_confirmation'].includes(candidate.status) || typeof candidate.basis !== 'string' || candidate.basis.length > 1000 || typeof candidate.purpose !== 'string' || candidate.purpose.length > 500 || !Array.isArray(candidate.supporting_keywords) || candidate.supporting_keywords.length > 8 || candidate.supporting_keywords.some(keyword => typeof keyword !== 'string' || keyword.length > 100)) {
        throw Error('Invalid purpose or keywords for Project ' + candidate.name + '.');
      }
      const keywords = [...new Map(candidate.supporting_keywords.map(keyword => [normalize(keyword), keyword.trim()]).filter(([key, value]) => key && value)).values()];
      const configured = currentByName.get(key) || [];
      if (configured.length > 1) throw Error('Project name is ambiguous: ' + candidate.name + '. Resolve duplicate names before importing.');
      if (configured.length === 1) {
        const current = configured[0];
        const proposedURL = candidate.url ? safeURL(candidate.url) : '';
        if (candidate.url && (!proposedURL || !/^\/g\/[\w-]+\/project\/?$/.test(new URL(proposedURL).pathname))) throw Error('Invalid ChatGPT Project URL for ' + candidate.name + '.');
        if (current.url && proposedURL && current.url !== proposedURL) throw Error('The proposed URL conflicts with the configured URL for ' + candidate.name + '. Review it manually.');
        const url = current.url || proposedURL;
        if (url && currentProjects.some(project => project.id !== current.id && project.url === url)) throw Error('The Project URL is already assigned to another destination.');
        updates.set(current.id,{...current, purpose:candidate.purpose, keywords, discoveryStatus:candidate.status, discoveryBasis:candidate.basis, url, active:current.url ? current.active : false});
        continue;
      }
      const proposedURL = candidate.url ? safeURL(candidate.url) : '';
      if (candidate.url && (!proposedURL || !/^\/g\/[\w-]+\/project\/?$/.test(new URL(proposedURL).pathname))) throw Error('The supplied URL is not a valid ChatGPT Project URL for ' + candidate.name + '.');
      if (proposedURL && currentProjects.some(project => project.url === proposedURL)) throw Error('The Project URL is already assigned to another destination.');
      const id = root.crypto?.randomUUID?.() || 'project-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,10);
      added.push({id,name:candidate.name,purpose:candidate.purpose,url:proposedURL,keywords,discoveryStatus:candidate.status,discoveryBasis:candidate.basis,active:false});
    }
    if (!seen.size) return {projects:currentProjects, limitations:imported.limitations, hasUpdates:false};
    return {projects:[...currentProjects.map(project => updates.get(project.id)),...added],limitations:imported.limitations,hasUpdates:true};
  }
  function parseRouteSuggestion(text, projects, configVersion = CONFIG_VERSION) {
    const match = String(text).match(/```scr-route\s*([\s\S]*?)```/i);
    if (!match) return {found:false};
    let value;
    try { value = JSON.parse(match[1]); }
    catch { return {found:true,ok:false,error:'The routing suggestion is not valid JSON.'}; }
    const expectedKeys = ['config_version','project_id','protocol_token','reason','schema'];
    if (!value || Object.keys(value).sort().join(',') !== expectedKeys.join(',') || value.schema !== PROTOCOL_SCHEMA || value.protocol_token !== PROTOCOL_TOKEN || value.config_version !== configVersion) {
      return {found:true,ok:false,error:'The routing suggestion uses an unsupported protocol version or fields.'};
    }
    if (typeof value.reason !== 'string' || !value.reason.trim() || value.reason.length > 500) return {found:true,ok:false,error:'The routing suggestion has an invalid reason.'};
    const project = projects.find(item => {
      const url = safeURL(item.url);
      return item.id === value.project_id && item.active && url && /^\/(?:c\/[\w-]+|g\/[\w-]+\/(?:project|c\/[\w-]+))$/.test(new URL(url).pathname);
    });
    if (!project) return {found:true,ok:false,error:'The routing suggestion refers to an unknown or inactive Project.'};
    return {found:true,ok:true,project,reason:value.reason.trim(),key:JSON.stringify(value)};
  }
  function suggestKeywords(name) {
    const text = normalize(name);
    const suggestions = new Set();
    String(name).trim().split(/\s+/).filter(word => word.length > 2 && /^[a-z0-9-]+$/i.test(word)).forEach(word => suggestions.add(word));
    const groups = [
      [['job', 'career', 'search', 'resume'], ['job search', 'resume', 'cover letter', 'interview']],
      [['paper', 'research', 'academic'], ['research', 'paper', 'literature review', 'analysis', 'draft']],
      [['thesis', 'dissertation'], ['thesis', 'dissertation', 'literature review', 'defense']],
      [['codonbert', 'codon', 'protein', 'bioinformatics'], ['CodonBERT', 'codon', 'protein', 'tokenization']],
      [['writing', 'writer', 'book', 'novel'], ['writing', 'draft', 'editing', 'outline']],
      [['finance', 'financial', 'investment', 'money'], ['finance', 'budget', 'investment', 'financial plan']]
    ];
    for (const [terms, keywords] of groups) {
      if (terms.some(term => text.includes(term))) keywords.forEach(keyword => suggestions.add(keyword));
    }
    return [...suggestions].filter(Boolean).slice(0, 12);
  }
  const api = {defaults, safeURL, classify, createReferenceHandoff, suggestKeywords, migrateSettings, createActivationPrompt, validateRegistryImport, parseRouteSuggestion, protocol:{schema:PROTOCOL_SCHEMA,token:PROTOCOL_TOKEN,configVersion:CONFIG_VERSION}};
  root.SCR = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
