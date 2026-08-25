export const INSPECTION_REPORT_SCHEMA = 'good-ship-local-tools/privacy-inspection';
export const INSPECTION_REPORT_VERSION = 1;

function normalise(value) {
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalise);
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, normalise(item)]));
  }
  if (['string', 'number', 'boolean'].includes(typeof value)) return value;
  return String(value);
}

export function createInspectionSource({ name, includeName = false, sha256 = null, ...rest } = {}) {
  const source = { ...rest };
  if (sha256) source.sha256 = sha256;
  if (includeName && name) source.name = name;
  return source;
}

export function inspectionReportFilename({ sha256 = null, name = null, includeName = false } = {}) {
  if (includeName && name) return `${name}-privacy-report.json`;
  return sha256 ? `privacy-inspection-${sha256.slice(0, 12)}.json` : 'privacy-inspection-report.json';
}

export function createInspectionReport({
  tool,
  generatedAt,
  source,
  findings,
  details = null,
  includeDetails = false,
  cleaning = null,
  limitations = [],
}) {
  if (!tool) throw new Error('Inspection report tool name is required.');
  const report = {
    schema: INSPECTION_REPORT_SCHEMA,
    version: INSPECTION_REPORT_VERSION,
    generatedAt: generatedAt || new Date().toISOString(),
    tool,
    source: normalise(source || {}),
    findings: normalise(findings || {}),
    cleaning: cleaning ? normalise(cleaning) : null,
    limitations: normalise(limitations),
  };
  if (includeDetails && details) report.details = normalise(details);
  return report;
}

export function inspectionReportJson(report) {
  return JSON.stringify(report, null, 2) + '\n';
}
