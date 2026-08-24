import {test, expect} from '@playwright/test'

const SERVER_URL = process.env.VITE_SERVER_URL || 'http://localhost:3001'
const uniqueSuffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

test.describe('AskVERA Example App', () => {
    test.beforeEach(async ({page}) => {
        // Verify example server is reachable before each test
        const health = await page.request.get(`${SERVER_URL}/health`)
        expect(health.ok()).toBe(true)
    })

    test('setup form loads with all required fields', async ({page}) => {
        await page.goto('/')

        // Header
        await expect(page.locator('h1')).toHaveText('Ask VERA')

        // All form fields present
        await expect(page.locator('#firstName')).toBeVisible()
        await expect(page.locator('#lastName')).toBeVisible()
        await expect(page.locator('#email')).toBeVisible()
        await expect(page.locator('#postalCode')).toBeVisible()
        await expect(page.locator('#petName')).toBeVisible()
        await expect(page.locator('#species')).toBeVisible()
        await expect(page.locator('#birthDate')).toBeVisible()
        await expect(page.locator('#question')).toBeVisible()

        // Submit button
        await expect(page.locator('button[type="submit"]')).toHaveText('Start Chat →')
    })

    test('species dropdown has expected options', async ({page}) => {
        await page.goto('/')
        const options = await page.locator('#species option').allTextContents()
        expect(options).toContain('Dog')
        expect(options).toContain('Cat')
        expect(options.length).toBeGreaterThanOrEqual(5)
    })

    test('submit button is disabled while loading', async ({page}) => {
        await page.goto('/')

        // Fill the form
        const suffix = uniqueSuffix()
        await page.fill('#firstName', 'Test')
        await page.fill('#lastName', 'User')
        await page.fill('#email', `test-${suffix}@howaya.net`)
        await page.fill('#postalCode', '90210')
        await page.fill('#petName', `Pet${suffix}`)
        await page.selectOption('#species', 'Dog')
        await page.fill('#birthDate', '2020-01-15')
        await page.fill('#question', 'Is my dog healthy?')

        // Click submit — button should show loading state
        await page.click('button[type="submit"]')
        await expect(page.locator('button[type="submit"]')).toBeDisabled()
        await expect(page.locator('.btn-loading')).toBeVisible()
    })

    test('full chat flow: fill form → start session → see chat window → send message → end chat → new chat', async ({
        page,
    }) => {
        await page.goto('/')

        // ── Step 1: Fill in the setup form ──
        const suffix = uniqueSuffix()
        await page.fill('#firstName', 'Playwright')
        await page.fill('#lastName', 'Tester')
        await page.fill('#email', `test-${suffix}@howaya.net`)
        await page.fill('#postalCode', '10001')
        await page.fill('#petName', `Buddy${suffix}`)
        await page.selectOption('#species', 'Dog')
        await page.fill('#birthDate', '2019-06-15')
        await page.fill('#question', 'My dog has been limping. What should I do?')

        // ── Step 2: Submit and wait for chat window ──
        await page.click('button[type="submit"]')

        // Chat window should appear (header with "Ask VERA" and chat UI elements)
        await expect(page.locator('.chat-header')).toBeVisible({timeout: 30_000})
        await expect(page.locator('.chat-title')).toHaveText('Ask VERA')

        // Session badge should show AI mode
        await expect(page.locator('.session-badge')).toBeVisible()

        // The opening question should appear as a user message
        await expect(page.locator('.msg-user').first()).toBeVisible()

        // Input field and send button should be present
        await expect(page.locator('.chat-input')).toBeVisible()
        await expect(page.locator('.chat-send-btn')).toBeVisible()

        // Paperclip (attach image) button should be present
        await expect(page.locator('.chat-attach-btn')).toBeVisible()

        // ── Step 3: Send a follow-up message ──
        await page.fill('.chat-input', 'Can you tell me more about limping in dogs?')
        await page.click('.chat-send-btn')

        // The new user message should appear
        await expect(page.locator('.msg-user').nth(1)).toBeVisible({timeout: 15_000})

        // ── Step 4: End the chat ──
        await page.click('.btn-end')

        // Ended banner should appear
        await expect(page.locator('.live-cta-ended')).toBeVisible({timeout: 15_000})
        await expect(page.locator('.live-cta-ended')).toContainText('This session has ended')

        // Input field should be gone
        await expect(page.locator('.chat-input')).not.toBeVisible()

        // ── Step 5: Start a new chat ──
        await page.click('.live-cta-ended >> button')

        // Should be back to the setup form
        await expect(page.locator('h1')).toHaveText('Ask VERA')
        await expect(page.locator('#firstName')).toBeVisible()
    })

    test('live vet request button is visible in AI session', async ({page}) => {
        await page.goto('/')

        const suffix = uniqueSuffix()
        await page.fill('#firstName', 'Live')
        await page.fill('#lastName', 'Tester')
        await page.fill('#email', `test-${suffix}@howaya.net`)
        await page.fill('#postalCode', '90210')
        await page.fill('#petName', `Rex${suffix}`)
        await page.selectOption('#species', 'Dog')
        await page.fill('#birthDate', '2021-03-10')
        await page.fill('#question', 'My dog is scratching a lot')

        await page.click('button[type="submit"]')
        await expect(page.locator('.chat-header')).toBeVisible({timeout: 30_000})

        // Live vet CTA should be visible for AI sessions
        await expect(page.locator('.btn-live')).toBeVisible()
        await expect(page.locator('.btn-live')).toContainText('Request Live Vet')
    })

    test('new chat button returns to setup form from active session', async ({page}) => {
        await page.goto('/')

        const suffix = uniqueSuffix()
        await page.fill('#firstName', 'NewChat')
        await page.fill('#lastName', 'Tester')
        await page.fill('#email', `test-${suffix}@howaya.net`)
        await page.fill('#postalCode', '90210')
        await page.fill('#petName', `Spot${suffix}`)
        await page.selectOption('#species', 'Cat')
        await page.fill('#birthDate', '2022-01-01')
        await page.fill('#question', 'Is my cat eating enough?')

        await page.click('button[type="submit"]')
        await expect(page.locator('.chat-header')).toBeVisible({timeout: 30_000})

        // Click "+ New Chat"
        await page.click('.btn-new')

        // Should return to setup form
        await expect(page.locator('h1')).toHaveText('Ask VERA')
        await expect(page.locator('#firstName')).toBeVisible()
    })

    test('form validation prevents empty submission', async ({page}) => {
        await page.goto('/')

        // Try clicking submit without filling anything
        // HTML5 required attributes should prevent submission
        const submitBtn = page.locator('button[type="submit"]')
        await submitBtn.click()

        // Should still be on the setup form (not navigated to chat)
        await expect(page.locator('h1')).toHaveText('Ask VERA')
        await expect(page.locator('.chat-header')).not.toBeVisible()
    })
})
