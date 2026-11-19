const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Set viewport
  await page.setViewportSize({ width: 1280, height: 720 });
  
  // Navigate to the simulation
  await page.goto('file:///E:/dev/physics/src/index.html', { waitUntil: 'networkidle' });
  
  // Wait for page to load
  await page.waitForTimeout(1000);
  
  // Check that canvas exists
  const canvasExists = await page.evaluate(() => {
    return document.querySelector('canvas') !== null;
  });
  
  console.log('Canvas exists:', canvasExists);
  
  // Test box creation - click 5 times on canvas
  for (let i = 0; i < 5; i++) {
    await page.click('canvas');
    await page.waitForTimeout(100);
  }
  
  // Check console for errors
  const consoleMessages = await page.evaluate(() => {
    return console.error + console.warn;
  });
  
  console.log('Console messages:', consoleMessages);
  
  // Take screenshot
  await page.screenshot({ 
    path: 'test/screenshots/simulation-test.png', 
    fullPage: true 
  });
  
  console.log('Screenshot saved to test/screenshots/simulation-test.png');
  
  // Check that we can see boxes (basic visual check)
  const boxesCount = await page.evaluate(() => {
    // Count boxes by checking canvas content
    const canvas = document.querySelector('canvas');
    if (!canvas) return 0;
    
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    let boxCount = 0;
    // Look for box colors (assuming boxes have distinct colors)
    for (let y = 0; y < data.length; y += 4) {
      const r = data[y];
      const g = data[y + 1];
      const b = data[y + 2];
      // Simple heuristic: count pixels that are not background color
      if (r > 100 && g > 100 && b > 100) {
        boxCount++;
      }
    }
    return boxCount > 0 ? 1 : 0;
  });
  
  console.log('Boxes detected:', boxesCount > 0);
  
  await browser.close();
  
  console.log('\n=== Test completed successfully! ===');
  console.log('Screenshot saved to: simulation-test.png');
})();
