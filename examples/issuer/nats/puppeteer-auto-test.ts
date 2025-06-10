#!/usr/bin/env bun
import puppeteer from "puppeteer"

async function testPasswordFlow() {
  console.log("🧪 Starting automated NATS password flow test...")
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--disable-web-security", "--disable-features=IsolateOrigins,site-per-process"]
  })
  
  try {
    // Create two pages - one for the test page, one for monitoring console
    const testPage = await browser.newPage()
    
    // Navigate to test page
    console.log("📄 Loading test page...")
    await testPage.goto(`file://${process.cwd()}/test-password.html`)
    
    // Test server status first
    console.log("🔍 Checking server status...")
    await testPage.click('button[onclick="checkServerStatus()"]')
    await testPage.waitForTimeout(1000)
    
    const serverStatus = await testPage.evaluate(() => {
      const statusDiv = document.getElementById('statusResult')
      return statusDiv?.textContent || ''
    })
    
    if (!serverStatus.includes('200 OK')) {
      throw new Error('Server not responding')
    }
    console.log("✅ Server is running")
    
    // Start auth flow
    console.log("🚀 Starting auth flow...")
    
    // Set up to capture the popup
    const newPagePromise = new Promise<puppeteer.Page>(resolve => {
      browser.on('targetcreated', async target => {
        const page = await target.page()
        if (page) resolve(page)
      })
    })
    
    // Click the auth button
    await testPage.click('button[onclick="testAuthFlow()"]')
    
    // Wait for auth page to open
    const authPage = await newPagePromise
    await authPage.waitForLoadState('networkidle')
    console.log("📱 Auth page opened:", authPage.url())
    
    // Wait for email input and fill it
    console.log("📧 Entering email...")
    await authPage.waitForSelector('input[type="email"]', { visible: true })
    await authPage.type('input[type="email"]', 'test@example.com')
    
    // Find and click submit button
    await authPage.click('button[type="submit"]')
    
    // Wait for code input to appear
    console.log("⏳ Waiting for verification code input...")
    await authPage.waitForSelector('input[inputmode="numeric"]', { visible: true })
    
    console.log("🔑 Verification code input detected!")
    
    // In a real test, we would capture the code from server logs
    // For this demo, we'll simulate entering a code
    console.log("📝 Note: In production, you would capture the code from server logs")
    console.log("⚠️  For now, enter the code manually in the browser")
    
    // Keep browser open for 30 seconds to allow manual code entry
    console.log("\n⏰ Browser will stay open for 30 seconds...")
    console.log("Enter the verification code from the server console to complete the flow")
    
    await new Promise(resolve => setTimeout(resolve, 30000))
    
    console.log("✅ Test completed!")
    
  } catch (error) {
    console.error("❌ Test failed:", error)
  } finally {
    await browser.close()
  }
}

// Helper to wait for page load
puppeteer.Page.prototype.waitForLoadState = function(state = 'load') {
  const page = this as puppeteer.Page
  return new Promise<void>((resolve) => {
    if (state === 'networkidle') {
      page.waitForLoadState('networkidle0', { timeout: 5000 })
        .then(() => resolve())
        .catch(() => resolve()) // Ignore timeout, page is probably loaded
    } else {
      page.waitForNavigation({ waitUntil: state as any })
        .then(() => resolve())
        .catch(() => resolve())
    }
  })
}

// Run the test
testPasswordFlow().catch(console.error)