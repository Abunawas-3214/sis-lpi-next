import puppeteer from 'C:/Users/plesk/.bun/install/cache/puppeteer@25.17.0@@@1/lib/puppeteer/puppeteer.js';

(async () => {
  const browser = await puppeteer.launch({ 
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true 
  });
  const page = await browser.newPage();
  await page.setCookie({
    name: 'auth_session',
    value: 'eyJpZCI6MSwidXNlcm5hbWUiOiJzdXBlcmFkbWluIiwibmFtZSI6IlN1cGVyIEFkbWluaXN0cmF0b3IiLCJyb2xlIjoic3VwZXJfYWRtaW4ifQ.ZSLW4Q9Hb_220p9gJOoNL73PNq_krSqurtVqO_wsY34',
    domain: 'localhost',
    path: '/'
  });

  for (const w of [768, 800, 850, 900, 950, 1000, 1024]) {
    await page.setViewport({ width: w, height: 600 });
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    await page.hover('header > div');
    await new Promise(r => setTimeout(r, 400));
    const data = await page.evaluate(() => {
      const header = document.querySelector('header');
      const inner = header ? header.querySelector('div') : null;
      const btnAbout = header ? header.querySelector('a[href="/about"]') : null;
      const btnRect = btnAbout ? btnAbout.getBoundingClientRect() : { width: 0, right: 0 };
      const innerRect = inner ? inner.getBoundingClientRect() : { width: 0, right: 0 };
      const hoverContainer = btnAbout ? btnAbout.parentElement : null;
      const hoverRect = hoverContainer ? hoverContainer.getBoundingClientRect() : { width: 0, right: 0 };
      return {
        headerW: header ? header.getBoundingClientRect().width : 0,
        innerW: innerRect.width,
        hoverW: hoverRect.width,
        hoverScrollW: hoverContainer ? hoverContainer.scrollWidth : 0,
        btnAboutW: btnRect.width,
        btnAboutScrollW: btnAbout ? btnAbout.scrollWidth : 0
      };
    });
    console.log('Viewport ' + w + ':', JSON.stringify(data));
  }
  await browser.close();
})();
