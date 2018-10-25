import * as d from '../../declarations';
import { catchError } from '../util';
import { minifyJs } from '../minifier';
import { optimizeCss } from '../style/optimize-css';


export async function minifyInlinedContent(config: d.Config, compilerCtx: d.CompilerCtx, buildCtx: d.BuildCtx, doc: HTMLDocument) {
  await Promise.all([
    minifyInlineScripts(config, compilerCtx, buildCtx.diagnostics, doc),
    minifyInlineStyles(config, compilerCtx, buildCtx.diagnostics, doc)
  ]);
}


export async function minifyInlineScripts(config: d.Config, compilerCtx: d.CompilerCtx, diagnostics: d.Diagnostic[], doc: HTMLDocument) {
  const scripts = doc.querySelectorAll('script');
  const promises: Promise<any>[] = [];

  for (let i = 0; i < scripts.length; i++) {
    promises.push(minifyInlineScript(config, compilerCtx, diagnostics, scripts[i]));
  }

  await Promise.all(promises);
}


export function canMinifyInlineScript(script: HTMLScriptElement) {
  if (script.hasAttribute('src')) {
    return false;
  }

  if (typeof script.innerHTML !== 'string') {
    return false;
  }

  script.innerHTML = script.innerHTML.trim();

  if (script.innerHTML.length === 0) {
    return false;
  }

  let type = script.getAttribute('type');
  if (typeof type === 'string') {
    type = type.trim().toLowerCase();
    if (!VALID_SCRIPT_TYPES.includes(type)) {
      return false;
    }
  }

  if (script.innerHTML.includes('  ')) {
    return true;
  }

  if (script.innerHTML.includes('\t')) {
    return true;
  }

  return false;
}

const VALID_SCRIPT_TYPES = ['application/javascript', 'application/ecmascript', ''];


export async function minifyInlineScript(config: d.Config, compilerCtx: d.CompilerCtx, diagnostics: d.Diagnostic[], script: HTMLScriptElement) {
  if (!canMinifyInlineScript(script)) {
    return;
  }

  script.innerHTML = await minifyJs(config, compilerCtx, diagnostics, script.innerHTML, 'es5', false);
}


export async function minifyInlineStyles(config: d.Config, compilerCtx: d.CompilerCtx, diagnostics: d.Diagnostic[], doc: HTMLDocument) {
  try {
    const styles = doc.querySelectorAll('style');
    const promises: Promise<any>[] = [];

    for (let i = 0; i < styles.length; i++) {
      promises.push(minifyInlineStyle(config, compilerCtx, diagnostics, styles[i]));
    }

    await Promise.all(promises);

  } catch (e) {
    catchError(diagnostics, e);
  }
}


export function canMinifyInlineStyle(style: HTMLStyleElement) {
  if (typeof style.innerHTML !== 'string') {
    return false;
  }

  style.innerHTML = style.innerHTML.trim();

  if (style.innerHTML.length === 0) {
    return false;
  }

  if (style.innerHTML.includes('/*')) {
    return true;
  }

  if (style.innerHTML.includes('  ')) {
    return true;
  }

  if (style.innerHTML.includes('\t')) {
    return true;
  }

  return false;
}


async function minifyInlineStyle(config: d.Config, compilerCtx: d.CompilerCtx, diagnostics: d.Diagnostic[], style: HTMLStyleElement) {
  if (canMinifyInlineStyle(style)) {
    style.innerHTML = await optimizeCss(config, compilerCtx, diagnostics, style.innerHTML, null, true);
  }
}
