const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT_DIR = path.join(__dirname, 'evidence');
const BASE = 'http://localhost:5173';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function clickByText(page, selector, text) {
  return page.evaluate((sel, t) => {
    const els = Array.from(document.querySelectorAll(sel));
    const match = els.find(b => b.textContent && b.textContent.includes(t));
    if (match) { match.click(); return true; }
    return false;
  }, selector, text);
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1280, height: 800 },
  });
  const page = await browser.newPage();

  // resume the same student created earlier (has placement history + blocks)
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await page.evaluate(() => {
    localStorage.setItem('neurotutor_current_student', 'evaluation_demo_student');
    localStorage.setItem('neurotutor_known_students', JSON.stringify(['evaluation_demo_student']));
  });
  await page.goto(BASE + '/blocks', { waitUntil: 'networkidle0' });
  await sleep(1500);

  // click the "Control Flow" block card specifically
  await clickByText(page, 'button.text-left', 'Control Flow');
  await sleep(2000);
  await page.screenshot({ path: path.join(OUT_DIR, 'app_main_loop.png') });

  // mobile viewport of whatever's showing now (should be the loop, not blocks)
  await page.setViewport({ width: 390, height: 844 });
  await sleep(500);
  await page.screenshot({ path: path.join(OUT_DIR, 'app_mobile_loop.png') });

  await browser.close();
  console.log('done');
})();
