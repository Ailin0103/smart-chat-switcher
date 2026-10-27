/* Pure routing logic: replace classify() to add embeddings or an LLM later. */
(function (root) {
  const projects = [
    ['job', 'Job Search', ['resume', 'cover letter', 'job search', 'interview', '简历', '求职', '面试']],
    ['paper', 'Paper 2', ['paper 2', 'random matrix', 'lyapunov', 'non-adherence', '第二篇', '随机矩阵']],
    ['codon', 'CodonBERT', ['codonbert', 'codon', 'protein', 'tokenization', '密码子']],
    ['chubby', 'Chubby Group', ['chubby group', 'chubby', '小胖组']],
    ['thesis', 'Dissertation', ['dissertation', 'thesis', 'defense', '博士论文', '答辩']]
  ].map(([id, name, keywords]) => ({id, name, keywords, url: '', active: true}));
  const defaults = {enabled: true, autoRoute: true, includeContext: true, projects};
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
    const ranked = list.filter(p => p.active && safeURL(p.url)).map(p => {
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
  function handoff(message, excerpts, source, includeContext) {
    const summary = includeContext ? excerpts.slice(-3).map(s => String(s).replace(/\s+/g, ' ').trim().slice(0, 300)).filter(Boolean).join('\n') : '';
    return (summary ? 'Context excerpts from the previous conversation (background only):\n' + summary + '\nSource: ' + source + '\n\n' : '') + 'Current request:\n' + message;
  }
  const HANDOFF_LIMIT = 30000;
  function createReferenceHandoff({currentRequest, source, destination, id, referenceEnabled = true}) {
    if (typeof currentRequest !== 'string' || currentRequest.length > HANDOFF_LIMIT) throw Error('Current request is too large to hand off.');
    const text = referenceEnabled
      ? [
          '[Smart Conversation Router — Context Reference]',
          '',
          'I was routed here from another ChatGPT conversation.',
          '',
          'Source conversation:',
          'Title: ' + (source.title || 'Unavailable'),
          'URL: ' + (source.url || 'Unavailable'),
          'Conversation ID: ' + (source.conversation_id || 'Unavailable'),
          '',
          'Please retrieve relevant context from that source conversation if accessible, especially the most recent discussion, decisions, and unresolved questions.',
          'If you cannot access the source conversation, explicitly state that limitation. Do not infer or fabricate its contents.',
          '',
          'Current request:',
          currentRequest
        ].join('\n')
      : 'Current request:\n' + currentRequest;
    if (text.length > HANDOFF_LIMIT) throw Error('Handoff is too large. The original request remains in the source composer.');
    return {version:'1.0', id, source, destination, current_request:currentRequest, reference_enabled:referenceEnabled, text};
  }
  const api = {defaults, safeURL, classify, createReferenceHandoff};
  root.SCR = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
