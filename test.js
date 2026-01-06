const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    // Collect console messages
    const consoleMessages = [];
    page.on('console', msg => {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect errors
    const errors = [];
    page.on('pageerror', error => {
        errors.push(error.message);
    });

    try {
        // Navigate to the local file
        const filePath = path.join(__dirname, 'index.html');
        await page.goto(`file://${filePath}`);

        // Wait for the page to load
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000);

        // Check if main elements are visible
        const uploadArea = await page.locator('#uploadArea').isVisible();
        const logo = await page.locator('.logo').isVisible();
        const header = await page.locator('header').isVisible();

        console.log('=== Page Load Test Results ===');
        console.log(`Upload Area Visible: ${uploadArea}`);
        console.log(`Logo Visible: ${logo}`);
        console.log(`Header Visible: ${header}`);

        // Check for critical errors
        const criticalErrors = errors.filter(e => 
            !e.includes('favicon') && 
            !e.includes('MediaPipe') &&
            !e.includes('wasm')
        );

        console.log('\n=== Console Messages ===');
        consoleMessages.forEach(msg => {
            if (msg.type === 'error' || msg.type === 'warning') {
                console.log(`[${msg.type.toUpperCase()}]: ${msg.text}`);
            }
        });

        console.log('\n=== Errors ===');
        if (criticalErrors.length > 0) {
            criticalErrors.forEach(e => console.log(`ERROR: ${e}`));
            console.log('FAIL: Critical errors found');
        } else {
            console.log('PASS: No critical errors');
        }

        // Check page title
        const title = await page.title();
        console.log(`\nPage Title: ${title}`);

        console.log('\n=== Test Complete ===');

    } catch (error) {
        console.error('Test failed:', error.message);
    } finally {
        await browser.close();
    }
})();
