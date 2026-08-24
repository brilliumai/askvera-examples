import {test, expect} from '@playwright/test'

const SERVER_URL = process.env.VITE_SERVER_URL || 'http://localhost:3001'
const WS_SERVER = SERVER_URL.replace(/^http/, 'ws')
const uniqueSuffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

test.describe('WebSocket connectivity', () => {
    test.beforeEach(async ({page}) => {
        const health = await page.request.get(`${SERVER_URL}/health`)
        expect(health.ok()).toBe(true)
    })

    test('example server WS connects and receives session.update events', async ({page}) => {
        // 1. Create a session via the example server REST API
        const suffix = uniqueSuffix()
        const startRes = await page.request.post(`${SERVER_URL}/api/sessions/start`, {
            data: {
                firstName: 'WS',
                lastName: 'Tester',
                email: `ws-test-${suffix}@howaya.net`,
                postalCode: '10001',
                petName: `Paws${suffix}`,
                species: 'Dog',
                breed: 'Mixed',
                birthDate: '2020-01-01',
                question: 'Is my dog healthy?',
            },
        })
        expect(startRes.ok()).toBe(true)
        const {sessionId} = await startRes.json()
        expect(sessionId).toBeTruthy()

        // 2. Connect to the example server's WebSocket and wait for a session.update
        const wsResult = await page.evaluate(
            ({wsBase, sid}) => {
                return new Promise((resolve, reject) => {
                    const ws = new WebSocket(`${wsBase}/ws?sessionId=${sid}`)
                    const timeout = setTimeout(() => {
                        ws.close()
                        reject(new Error('WebSocket timed out waiting for session.update'))
                    }, 15000)

                    ws.onopen = () => {
                        // Connection established — good sign
                    }

                    ws.onmessage = (event) => {
                        try {
                            const data = JSON.parse(event.data)
                            if (data.type === 'session.update') {
                                clearTimeout(timeout)
                                ws.close()
                                resolve({
                                    type: data.type,
                                    hasSession: !!data.session,
                                    hasMessages: Array.isArray(data.session?.messages),
                                    sessionId: data.session?.id ?? null,
                                })
                            }
                        } catch {}
                    }

                    ws.onerror = (err) => {
                        clearTimeout(timeout)
                        reject(new Error(`WebSocket error: ${err.message || 'unknown'}`))
                    }

                    ws.onclose = (event) => {
                        clearTimeout(timeout)
                        if (event.code !== 1000) {
                            reject(
                                new Error(`WebSocket closed unexpectedly: code=${event.code} reason=${event.reason}`),
                            )
                        }
                    }
                })
            },
            {wsBase: WS_SERVER, sid: sessionId},
        )

        expect(wsResult.type).toBe('session.update')
        expect(wsResult.hasSession).toBe(true)
        expect(wsResult.hasMessages).toBe(true)
        expect(wsResult.sessionId).toBe(sessionId)
    })

    test('example server WS rejects connection without sessionId', async ({page}) => {
        const wsResult = await page.evaluate(
            ({wsBase}) => {
                return new Promise((resolve) => {
                    const ws = new WebSocket(`${wsBase}/ws`)
                    const timeout = setTimeout(() => {
                        ws.close()
                        resolve({closed: true, code: 'timeout'})
                    }, 5000)

                    ws.onclose = (event) => {
                        clearTimeout(timeout)
                        resolve({closed: true, code: event.code, reason: event.reason})
                    }

                    ws.onerror = () => {
                        // Expected — will trigger onclose
                    }
                })
            },
            {wsBase: WS_SERVER},
        )

        expect(wsResult.closed).toBe(true)
        expect(wsResult.code).toBe(4000)
        expect(wsResult.reason).toContain('sessionId')
    })

    test('browser chat window receives messages via WebSocket (not polling)', async ({page}) => {
        await page.goto('/')

        // Fill and submit the form
        const suffix = uniqueSuffix()
        await page.fill('#firstName', 'WSChat')
        await page.fill('#lastName', 'Tester')
        await page.fill('#email', `ws-chat-${suffix}@howaya.net`)
        await page.fill('#postalCode', '10001')
        await page.fill('#petName', `Rover${suffix}`)
        await page.selectOption('#species', 'Dog')
        await page.fill('#birthDate', '2019-06-15')
        await page.fill('#question', 'My dog has a rash on his belly')

        // Intercept WebSocket connections to verify one is opened
        const wsConnections = []
        page.on('websocket', (ws) => {
            wsConnections.push(ws.url())
        })

        await page.click('button[type="submit"]')

        // Wait for chat window to appear
        await expect(page.locator('.chat-header')).toBeVisible({timeout: 30_000})

        // Verify a WebSocket connection was made to the example server
        expect(wsConnections.length).toBeGreaterThanOrEqual(1)
        const wsUrl = wsConnections.find((url) => url.includes('/ws?sessionId='))
        expect(wsUrl).toBeTruthy()

        // The opening question should appear as a user message (delivered via WS)
        await expect(page.locator('.msg-user').first()).toBeVisible({timeout: 15_000})
    })
})
