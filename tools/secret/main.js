import { chrome, header, assurance, el, copyText } from '../../src/shell.js';
import { describeSecret, generateSecret, normaliseBits, terminalCommand } from '../../src/lib/secrets.js';

const PRESETS = {
  standard: { label:'Standard secret', format:'base64url', bits:256, env:'APP_SECRET' },
  session: { label:'JWT / session secret', format:'base64url', bits:256, env:'SESSION_SECRET' },
  webhook: { label:'Webhook secret', format:'hex', bits:256, env:'WEBHOOK_SECRET' },
  key: { label:'Encryption key material', format:'hex', bits:256, env:'ENCRYPTION_KEY' },
  strong: { label:'Strong secret', format:'base64url', bits:512, env:'APP_SECRET' },
  uuid: { label:'UUID v4', format:'uuid', bits:128, env:'ID' },
};

const FORMATS = [
  ['hex', 'Hex'],
  ['base64', 'Base64'],
  ['base64url', 'Base64URL'],
  ['alphanumeric', 'Alphanumeric'],
  ['uuid', 'UUID v4'],
];

const root = chrome('secret generator');
root.append(
  header('tool · security', 'Secret generator',
    'Generate cryptographically secure secrets locally, in the formats commonly needed for apps, environment variables, webhooks and authentication.'),
  el('div', { style:{ margin:'1rem 0 1.25rem' } },
    assurance('Secrets are generated in this browser with crypto.getRandomValues(). Nothing is uploaded, stored or added to browser history.')),
);

const purpose = el('select', { id:'secret-purpose', 'aria-label':'Purpose' },
  ...Object.entries(PRESETS).map(([value, preset]) => el('option', { value }, preset.label)),
  el('option', { value:'custom' }, 'Custom'),
);
const format = el('select', { id:'secret-format', 'aria-label':'Format' },
  ...FORMATS.map(([value, label]) => el('option', { value }, label)),
);
const strength = el('select', { id:'secret-strength', 'aria-label':'Strength' },
  el('option', { value:'128' }, '128 bit'),
  el('option', { value:'256', selected:true }, '256 bit'),
  el('option', { value:'512' }, '512 bit'),
  el('option', { value:'custom' }, 'Custom…'),
);
const customBits = el('input', {
  id:'secret-custom-bits', type:'number', min:64, max:4096, step:8, value:256,
  'aria-label':'Custom strength in bits', hidden:true,
});
const strengthHint = el('div', { class:'gs-mono gs-muted', style:{ fontSize:'.72rem', marginTop:'.35rem' } });

const output = el('input', {
  id:'secret-output', type:'password', readOnly:true, spellcheck:false, autocomplete:'off',
  'aria-label':'Generated secret',
  style:{ width:'100%', fontFamily:'var(--fm)', fontSize:'.92rem', padding:'.72rem', border:'1px solid var(--border)', borderRadius:'var(--r)', background:'var(--card)', color:'var(--text)' },
});
const status = el('div', { class:'gs-mono gs-muted', style:{ fontSize:'.72rem', minHeight:'1.2rem' }, 'aria-live':'polite' });
const reveal = el('button', { class:'gs-btn gs-btn-ghost', type:'button' }, 'Reveal');
const copy = el('button', { class:'gs-btn gs-btn-primary', type:'button' }, 'Copy');
const regenerate = el('button', { class:'gs-btn gs-btn-ghost', type:'button' }, 'Regenerate');

const envName = el('input', {
  id:'secret-env-name', type:'text', value:'APP_SECRET', spellcheck:false, autocomplete:'off',
  'aria-label':'Environment variable name', style:{ width:'min(100%, 360px)' },
});
const envLine = el('input', {
  id:'secret-env-line', type:'text', readOnly:true, spellcheck:false,
  'aria-label':'Environment variable line',
  style:{ width:'100%', marginTop:'.55rem', fontFamily:'var(--fm)' },
});
const envStatus = el('div', { class:'gs-mono', style:{ fontSize:'.72rem', minHeight:'1.2rem', marginTop:'.3rem' }, 'aria-live':'polite' });
const copyEnv = el('button', { class:'gs-btn gs-btn-ghost', type:'button' }, 'Copy .env line');

const command = el('input', {
  id:'secret-command', type:'text', readOnly:true, spellcheck:false,
  'aria-label':'Equivalent terminal command',
  style:{ width:'100%', fontFamily:'var(--fm)' },
});
const copyCommand = el('button', { class:'gs-btn gs-btn-ghost', type:'button' }, 'Copy command');

function currentBits() {
  if (format.value === 'uuid') return 128;
  return normaliseBits(strength.value === 'custom' ? customBits.value : strength.value);
}

function markCustom() {
  if (purpose.value !== 'custom') purpose.value = 'custom';
}

function syncStrengthUi() {
  const uuid = format.value === 'uuid';
  strength.disabled = uuid;
  customBits.disabled = uuid;
  customBits.hidden = uuid || strength.value !== 'custom';
}

function updateDerived() {
  try {
    const bits = currentBits();
    strengthHint.textContent = describeSecret(format.value, bits);
    command.value = terminalCommand(format.value, bits);
  } catch (error) {
    strengthHint.textContent = error.message;
    command.value = '';
  }
  updateEnv();
}

function updateEnv() {
  const name = envName.value.trim();
  const valid = /^[A-Za-z_][A-Za-z0-9_]*$/u.test(name);
  envLine.value = valid && output.value ? `${name}=${output.value}` : '';
  copyEnv.disabled = !valid || !output.value;
  envStatus.style.color = valid ? 'var(--muted)' : 'var(--gold)';
  envStatus.textContent = valid ? 'Safe for common .env syntax: generated formats contain no spaces or # characters.' : 'Use letters, numbers and underscores, starting with a letter or underscore.';
}

function generate() {
  try {
    output.value = generateSecret({ format:format.value, bits:currentBits() });
    status.style.color = 'var(--muted)';
    status.textContent = `${describeSecret(format.value, currentBits())} · generated fresh locally`;
    updateDerived();
  } catch (error) {
    output.value = '';
    status.style.color = 'var(--gold)';
    status.textContent = error.message;
    updateEnv();
  }
}

async function copyWithFeedback(button, text, original) {
  if (!text) return;
  const ok = await copyText(text);
  button.textContent = ok ? 'Copied' : 'Copy unavailable';
  setTimeout(() => { button.textContent = original; }, 1200);
}

purpose.addEventListener('change', () => {
  if (purpose.value === 'custom') return;
  const preset = PRESETS[purpose.value];
  format.value = preset.format;
  strength.value = String(preset.bits);
  customBits.value = String(preset.bits);
  envName.value = preset.env;
  syncStrengthUi();
  generate();
});
format.addEventListener('change', () => { markCustom(); syncStrengthUi(); generate(); });
strength.addEventListener('change', () => { markCustom(); syncStrengthUi(); generate(); });
customBits.addEventListener('change', () => { markCustom(); generate(); });
envName.addEventListener('input', updateEnv);
regenerate.addEventListener('click', generate);
reveal.addEventListener('click', () => {
  const showing = output.type === 'text';
  output.type = showing ? 'password' : 'text';
  reveal.textContent = showing ? 'Reveal' : 'Hide';
});
copy.addEventListener('click', () => copyWithFeedback(copy, output.value, 'Copy'));
copyEnv.addEventListener('click', () => copyWithFeedback(copyEnv, envLine.value, 'Copy .env line'));
copyCommand.addEventListener('click', () => copyWithFeedback(copyCommand, command.value, 'Copy command'));

root.append(
  el('section', { class:'gs-card' },
    el('div', { class:'gs-label', style:{ marginBottom:'.8rem' } }, 'generate'),
    el('div', { class:'gs-two-col' },
      el('label', {}, el('div', { class:'gs-mono gs-muted', style:{ fontSize:'.72rem', marginBottom:'.3rem' } }, 'Purpose'), purpose),
      el('label', {}, el('div', { class:'gs-mono gs-muted', style:{ fontSize:'.72rem', marginBottom:'.3rem' } }, 'Format'), format),
    ),
    el('div', { style:{ marginTop:'.8rem' } },
      el('label', {}, el('div', { class:'gs-mono gs-muted', style:{ fontSize:'.72rem', marginBottom:'.3rem' } }, 'Strength'), strength, customBits),
      strengthHint,
    ),
    el('div', { style:{ marginTop:'1rem' } }, output),
    el('div', { class:'gs-toolbar', style:{ marginTop:'.65rem' } }, copy, regenerate, reveal),
    el('div', { style:{ marginTop:'.45rem' } }, status),
  ),
  el('section', { class:'gs-card', style:{ marginTop:'1rem' } },
    el('div', { class:'gs-label', style:{ marginBottom:'.55rem' } }, '.env output'),
    el('p', { style:{ marginTop:0, fontSize:'.85rem' } }, 'Give the value a variable name and copy a ready-to-paste environment line.'),
    envName,
    envLine,
    envStatus,
    el('div', { style:{ marginTop:'.55rem' } }, copyEnv),
  ),
  el('section', { class:'gs-card', style:{ marginTop:'1rem' } },
    el('div', { class:'gs-label', style:{ marginBottom:'.55rem' } }, 'terminal equivalent'),
    el('p', { style:{ marginTop:0, fontSize:'.85rem' } }, 'Prefer generating the secret in a shell? This command produces the same kind and strength of value.'),
    command,
    el('div', { style:{ marginTop:'.55rem' } }, copyCommand),
  ),
  el('div', { class:'gs-warn', style:{ marginTop:'1rem' } },
    el('span', {}, 'Copying puts the secret on your system clipboard, where other applications may be able to read it. Sets does not save generated values and deliberately does not attempt to keep a history.')),
);

syncStrengthUi();
generate();
