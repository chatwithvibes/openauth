import { chromium } from 'playwright'

async function testNATSPasswordFlow() {
  console.log('🧪 Starting NATS Storage Password Flow Test...')
  
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-web-security', '--disable-features=IsolateOrigins,site-per-process']
  })
  
  const context = await browser.newContext()
  const page = await context.newPage()
  
  try {
    // Step 1: Load test page
    console.log('📄 Loading test page...')
    await page.goto('file://' + process.cwd() + '/test-password.html')
    
    // Step 2: Check server status
    console.log('🔍 Checking server status...')
    await page.click('button[onclick="checkServerStatus()"]')
    await page.waitForTimeout(1000)
    
    const serverStatus = await page.evaluate(() => {
      return document.getElementById('statusResult')?.textContent || ''
    })
    
    if (!serverStatus.includes('200 OK')) {
      throw new Error('Server not responding properly')
    }
    console.log('✅ Server is running')
    
    // Step 3: Initiate auth flow
    console.log('🚀 Starting auth flow...')
    
    // Listen for new page (popup)
    const [authPage] = await Promise.all([
      context.waitForEvent('page'),
      page.click('button[onclick="testAuthFlow()"]')
    ])
    
    await authPage.waitForLoadState()
    console.log('📱 Auth page opened:', authPage.url())
    
    // Step 4: Enter email
    console.log('📧 Entering email...')
    await authPage.waitForSelector('input[type="email"]', { timeout: 5000 })
    await authPage.fill('input[type="email"]', 'test@example.com')
    await authPage.click('button[type="submit"]')
    
    // Step 5: Wait for verification code input
    console.log('⏳ Waiting for verification code input...')
    await authPage.waitForSelector('input[placeholder*="code" i], input[name*="code" i]', { timeout: 5000 })
    
    console.log('🔑 Verification code input detected!')
    console.log('⚠️  Check the server console for the verification code!')
    console.log('📝 Enter the code manually in the browser window to complete the flow')
    
    // Keep browser open for manual completion
    console.log('\n✅ Test setup complete! Browser will remain open.')
    console.log('Press Ctrl+C to exit when done testing.')
    
    // Keep the script running
    await new Promise(() => {})
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    await browser.close()
    process.exit(1)
  }
}

// Run the test
testNATSPasswordFlow().catch(console.error)