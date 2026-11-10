const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT_DIR = path.join(__dirname, 'evidence');
const BASE = 'http://localhost:5173';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1280, height: 800 },
  });
  const page = await browser.newPage();

  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await page.evaluate(() => {
    localStorage.setItem('neurotutor_current_student', 'evaluation_demo_student');
    localStorage.setItem('neurotutor_known_students', JSON.stringify(['evaluation_demo_student']));
  });

  let found = false;
  for (let i = 0; i < 20 && !found; i++) {
    await page.goto(BASE + '/loop', { waitUntil: 'networkidle0' });
    await sleep(1200);
    const hasQuiz = await page.evaluate(() =>
      !!document.body.textContent.includes('Practice Question'));
    if (hasQuiz) {
      found = true;
      await page.screenshot({ path: path.join(OUT_DIR, 'app_quiz_mcq.png') });
      console.log('captured on attempt', i);
    }
  }
  if (!found) console.log('never landed on an MCQ round');

  await browser.close();
})();
