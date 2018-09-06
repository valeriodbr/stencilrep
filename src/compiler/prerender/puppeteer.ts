import * as d from '../../declarations';
import * as puppeteer from 'puppeteer'; // for types only


export async function prerenderWithBrowser(browser: puppeteer.Browser, prerenderLocation: d.PrerenderLocation) {
  const page = await browser.newPage();
  return page;
}


export async function startPuppeteerBrowser(config: d.Config) {
  const ptr = config.sys.lazyRequire.require('puppeteer');

  const launchOpts: puppeteer.LaunchOptions = {
    ignoreHTTPSErrors: true,
    // args: config.testing.browserArgs,
    headless: false,
    // slowMo: config.testing.browserSlowMo
  };

  const browser = await ptr.launch(launchOpts) as puppeteer.Browser;
  return browser;
}


export async function closePuppeteerBrowser(browser: puppeteer.Browser) {
  if (browser) {
    try {
      await browser.close();
    } catch (e) {}
  }
}


export async function ensurePuppeteer(config: d.Config) {
  await config.sys.lazyRequire.ensure(config.logger, config.rootDir, ['puppeteer']);
}
