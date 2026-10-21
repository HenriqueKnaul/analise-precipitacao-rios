// Runs a disposable browser against this app, never a user's browser profile.
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const assert = require('node:assert/strict');
async function main() {
  const server=spawn(process.env.TEST_PYTHON||'python',['-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8765'],{stdio:'pipe'});
  let logs='';server.stderr.on('data',d=>logs+=d);
  let browser;
  try {
    for(let i=0;i<40;i++){try{if((await fetch('http://127.0.0.1:8765/api/catalog')).ok)break;}catch{}if(i===39)throw Error('Server did not start: '+logs);await new Promise(r=>setTimeout(r,250));}
    browser=await chromium.launch({headless:true,...(process.env.TEST_BROWSER?{executablePath:process.env.TEST_BROWSER}:{})});
    const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    fs.mkdirSync('output/screenshots',{recursive:true});
    for(const width of [1366,768,360]){
      await page.setViewportSize({width,height:1000});await page.goto('http://127.0.0.1:8765');
      await page.waitForSelector('.chart svg');
      assert.equal(await page.locator('.metric').count(),2);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`horizontal overflow at ${width}`);
      await page.screenshot({path:`output/screenshots/${width}.png`,fullPage:true});
    }
    await page.locator('#resolution').selectOption('daily');await page.waitForSelector('.chart circle');
    await page.locator('#variables').selectOption('river');await page.waitForSelector('.empty');
    assert.match(await page.locator('.empty').innerText(),/Nível indisponível/);
    await page.locator('#variables').selectOption('rain');await page.waitForSelector('.chart svg');
    await page.locator('#current').click();await page.waitForFunction(()=>document.querySelectorAll('.metric').length===3);
    assert.match(await page.locator('#alignment').innerText(),/Último dado atual/);
    const download=page.waitForEvent('download');await page.locator('#download').click();assert.equal((await download).suggestedFilename(),'chuva-x-rio-comparacao.csv');
    assert.deepEqual(errors,[]);console.log('Browser checks passed: 1366/768/360, daily, missing river, current period, CSV, zero JS errors.');
  } finally {if(browser)await browser.close();server.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
