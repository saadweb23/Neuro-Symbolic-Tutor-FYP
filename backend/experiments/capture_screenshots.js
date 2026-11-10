const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT_DIR = path.join(__dirname, 'evidence');
const BASE = 'http://localhost:5173';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function clickByText(page, text) {
  return page.evaluate((t) => {
    const btns = Array.from(document.querySelectorAll('button'));
    const match = btns.find(b => b.textContent && b.textContent.includes(t));
    if (match) { match.click(); return true; }
    return false;
  }, text);
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1280, height: 800 },
  });
  const page = await browser.newPage();

  // fresh student
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await sleep(500);
  await page.screenshot({ path: path.join(OUT_DIR, 'app_landing.png') });

  // enter student id
  await page.type('input#studentId', 'evaluation_demo_student');
  await page.click('button[type="submit"]');
  await sleep(1500);
  await page.screenshot({ path: path.join(OUT_DIR, 'app_placement_quiz.png') });

  // answer all 6 placement questions (first option each time)
  for (let i = 0; i < 6; i++) {
    const choices = await page.$$('div.space-y-3 > button');
    if (choices.length > 0) await choices[0].click();
    await sleep(200);
    await clickByText(page, 'Next') || await clickByText(page, 'Finish Placement');
    await sleep(700);
  }
  await sleep(1500);
  await page.screenshot({ path: path.join(OUT_DIR, 'app_placement_results.png') });

  // go to blocks picker
  await clickByText(page, 'Choose a Focus Area');
  await sleep(1500);
  await page.screenshot({ path: path.join(OUT_DIR, 'app_blocks.png') });

  // pick the first block
  const blockCards = await page.$$('button.text-left.bg-white');
  if (blockCards.length > 0) await blockCards[0].click();
  await sleep(1500);
  await page.screenshot({ path: path.join(OUT_DIR, 'app_main_loop.png') });

  // mastery dashboard
  await page.goto(BASE + '/mastery', { waitUntil: 'networkidle0' });
  await sleep(1000);
  await page.screenshot({ path: path.join(OUT_DIR, 'app_dashboard.png') });

  // mobile viewport of the loop screen
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(BASE + '/loop', { waitUntil: 'networkidle0' });
  await sleep(1000);
  await page.screenshot({ path: path.join(OUT_DIR, 'app_mobile_loop.png') });

  await browser.close();
  console.log('done');
})();
