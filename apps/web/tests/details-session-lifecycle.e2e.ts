// Keyless browser regression for the details column's default visibility and Session ownership.
// The shipped composition starts closed after selection and reload, retains an explicitly opened width through
// unselected states, and closes it only when a different Session takes ownership.
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'
import type { InstrumentRef } from '@deepseek-ai/dsh-market-data'
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from 'vitest'
import {
  acknowledgeReloadConnectionLoss, assertFixtureInventory, captureStableAria, compareOrRefreshGolden,
  fixtureUserPrompts, launchWebScaffold, seedSession, watchConsole, webSnapshotMode,
  type WebScaffold,
} from './scaffold.ts'
import { connectFreshWorkspace, newEnglishPage, saveFailureShot } from './support.ts'

const SNAPSHOT_DIR = fileURLToPath(new URL('./snapshots/details-session-lifecycle', import.meta.url))
const HANDLES_EXPECTED = join(SNAPSHOT_DIR, 'handles.expected.md')
const FIXTURE = fileURLToPath(new URL('./snapshots/lifecycle-chrome/session.jsonl', import.meta.url))
const SEED_FIXTURE = fileURLToPath(new URL('./snapshots/seeded-history/seed.jsonl', import.meta.url))
const CHICO_SNAPSHOT_DIR = fileURLToPath(new URL('./snapshots/chico-investment-workbench', import.meta.url))
const CHICO_WORKBENCH_EXPECTED = join(CHICO_SNAPSHOT_DIR, 'workbench.expected.md')
const CHICO_OVERLAY = fileURLToPath(
  new URL('../../../packages/bundle/chico-web-app/cordis.patch.yml', import.meta.url),
)
const PROMPT = 'Reply with the single word LIGHTHOUSE and stop.'
const MODE = webSnapshotMode()
const CATL = { market: 'SZSE', symbol: '300750' } as InstrumentRef

/** Last AppFrame grid track in CSS pixels. */
async function detailsTrack(page: Page): Promise<number> {
  return await appFrame(page).evaluate((element) => {
    const tracks = getComputedStyle(element).gridTemplateColumns.split(' ')
    return Number.parseFloat(tracks.at(-1) ?? 'NaN')
  })
}

/** First AppFrame grid track in CSS pixels. */
async function sidebarTrack(page: Page): Promise<number> {
  return await appFrame(page).evaluate((element) => {
    const tracks = getComputedStyle(element).gridTemplateColumns.split(' ')
    return Number.parseFloat(tracks[0] ?? 'NaN')
  })
}

/** AppFrame is the only product element with an inline grid track template. */
function appFrame(page: Page) {
  return page.locator('[style*="grid-template-columns"]').first()
}

/** Render the two column-resize handles without platform-dependent coordinates. */
async function handleSnapshot(page: Page): Promise<string> {
  const handles = await page.locator('[class*="handle"]').evaluateAll(elements =>
    elements.map(element => ({
      side: element.getAttribute('data-side'),
      cursor: getComputedStyle(element).cursor,
      pillGenerated: getComputedStyle(element, '::after').content !== 'none',
    })))
  return [
    '# AppFrame drag handles',
    '',
    ...handles.flatMap(handle => [
      `## ${handle.side}`,
      '',
      '- hit strip present: true',
      `- cursor: ${handle.cursor}`,
      `- pill generated: ${String(handle.pillGenerated)}`,
      '',
    ]),
  ].join('\n').trimEnd()
}

/** Stable Chico workbench projection across recovery and deletion. */
function chicoWorkbenchSnapshot(
  watchlist: string,
  defaultEvidence: string,
  collapsedWatchlist: string,
  reopenedRecord: string,
  deleteConfirmation: string,
  deletedWatchlist: string,
): string {
  return [
    '# Chico investment workbench',
    '',
    '## Watchlist',
    '',
    watchlist,
    '',
    '## Default evidence',
    '',
    defaultEvidence,
    '',
    '## Collapsed-details recovery',
    '',
    collapsedWatchlist,
    '',
    '## Reopened record',
    '',
    reopenedRecord,
    '',
    '## Delete confirmation',
    '',
    deleteConfirmation,
    '',
    '## After deleting the current conversation',
    '',
    deletedWatchlist,
  ].join('\n')
}

describe.skipIf(MODE === 'record')('web e2e: details panel follows the current Session lifecycle', () => {
  let scaffold: WebScaffold
  let browser: Browser
  let page: Page
  let tripwire: ReturnType<typeof watchConsole>

  beforeAll(async () => {
    const fixture = await readFile(FIXTURE, 'utf8')
    expect(fixtureUserPrompts(fixture)).toEqual([PROMPT])
    scaffold = await launchWebScaffold({ replayFixture: FIXTURE, paceMs: 5 })
    await seedSession(scaffold, await readFile(SEED_FIXTURE, 'utf8'), 'details-session-lifecycle-seed')
    browser = await chromium.launch()
    page = await newEnglishPage(browser)
    tripwire = watchConsole(page)
    await page.goto(scaffold.baseUrl, { waitUntil: 'load' })
    await appFrame(page).waitFor({ timeout: 30_000 })
    await connectFreshWorkspace(page, scaffold.workspaceCwd)
  }, 120_000)

  afterAll(async () => {
    await browser?.close()
    await scaffold?.close()
  })

  it('starts and reloads closed, then stays closed across Session ownership changes', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-details-session-lifecycle'))
    const settled = scaffold.whenTurnSettled()
    const input = page.locator('textarea').first()
    await input.fill(PROMPT)
    await input.press('Enter')
    await settled
    await page.getByText('LIGHTHOUSE', { exact: true }).waitFor({ timeout: 15_000 })

    await expect.poll(() => detailsTrack(page), { timeout: 5_000 }).toBe(0)
    expect(await page.getByText('Details', { exact: true }).isVisible()).toBe(false)
    await compareOrRefreshGolden(HANDLES_EXPECTED, await handleSnapshot(page), MODE)

    const sidebarBefore = await sidebarTrack(page)
    const sidebarHandle = page.locator('[data-side="sidebar"]')
    const sidebarBox = await sidebarHandle.boundingBox()
    expect(sidebarBox).not.toBeNull()
    const dragStartX = sidebarBox!.x + sidebarBox!.width / 2
    await page.mouse.move(dragStartX, sidebarBox!.y + 200)
    await page.mouse.down()
    await page.mouse.move(dragStartX + 70, sidebarBox!.y + 200, { steps: 6 })
    await page.mouse.up()
    await expect.poll(() => sidebarTrack(page), { timeout: 5_000 }).toBe(sidebarBefore + 70)

    const warningStart = tripwire.warnings.length
    await page.reload({ waitUntil: 'load' })
    acknowledgeReloadConnectionLoss(tripwire, warningStart)
    await appFrame(page).waitFor({ timeout: 30_000 })
    await page.getByText('LIGHTHOUSE', { exact: true }).waitFor({ timeout: 15_000 })
    await expect.poll(() => detailsTrack(page), { timeout: 5_000 }).toBe(0)
    expect(await page.getByText('Details', { exact: true }).isVisible()).toBe(false)

    await page.getByRole('button', { name: /^(?:New session|新.*会话)$/ }).last().click()
    await page.getByText('Into the Unknown', { exact: false }).waitFor({ timeout: 15_000 })
    await expect.poll(() => detailsTrack(page), { timeout: 5_000 }).toBe(0)
    expect(await page.getByText('Details', { exact: true }).isVisible()).toBe(false)

    const original = page.locator('[role=treeitem]').filter({ hasText: 'Reply with the single word' }).first()
    await original.click()
    await page.getByText('LIGHTHOUSE', { exact: true }).waitFor({ timeout: 15_000 })
    await expect.poll(() => detailsTrack(page), { timeout: 5_000 }).toBe(0)
    expect(await page.getByText('Details', { exact: true }).isVisible()).toBe(false)

    const ungrouped = page.getByText('Ungrouped', { exact: true })
    const ungroupedRow = ungrouped.locator('..').locator('..')
    const ungroupedSection = ungroupedRow.locator('..')
    await expect.poll(async () => {
      if (await ungroupedRow.getAttribute('aria-expanded') !== 'true') {
        await ungrouped.click()
        await page.waitForTimeout(50)
      }
      return await ungroupedRow.getAttribute('aria-expanded')
    }, { timeout: 5_000 }).toBe('true')
    const seeded = ungroupedSection.locator('[role="treeitem"]').nth(1)
    await seeded.click()
    await page.getByText('DONE', { exact: true }).waitFor({ timeout: 15_000 })
    await expect.poll(() => detailsTrack(page), { timeout: 5_000 }).toBe(0)
    expect(tripwire.pageErrors).toEqual([])
    expect(tripwire.warnings).toEqual([])
    await assertFixtureInventory(SNAPSHOT_DIR, ['handles.expected.md'])
  }, 90_000)
})

describe.skipIf(MODE === 'record')('web e2e: Chico investment workbench', () => {
  let scaffold: WebScaffold
  let browser: Browser
  let page: Page
  let tripwire: ReturnType<typeof watchConsole>

  beforeAll(async () => {
    scaffold = await launchWebScaffold({ extraOverlayPath: CHICO_OVERLAY })
    const executablePath = process.env.DSH_PLAYWRIGHT_EXECUTABLE_PATH
    browser = await chromium.launch(executablePath === undefined ? {} : { executablePath })
    page = await newEnglishPage(browser)
    tripwire = watchConsole(page)
    await page.goto(scaffold.baseUrl, { waitUntil: 'load' })
    await appFrame(page).waitFor({ timeout: 30_000 })
    await page.getByRole('tab', { name: 'Investing', exact: true }).waitFor({ timeout: 30_000 })
  }, 120_000)

  afterAll(async () => {
    const failures: unknown[] = []
    try {
      expect(tripwire?.pageErrors ?? []).toEqual([])
      expect(tripwire?.warnings ?? []).toEqual([])
    } catch (error) {
      failures.push(error)
    }
    await browser?.close().catch((error: unknown) => failures.push(error))
    await scaffold?.close().catch((error: unknown) => failures.push(error))
    if (failures.length === 1) throw failures[0]
    if (failures.length > 1) throw new AggregateError(failures, 'Chico workbench cleanup failed')
  })

  it('opens, collapses, reopens, and deletes one stock conversation', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-chico-investment-workbench'))

    await page.getByRole('tab', { name: 'Investing', exact: true }).click()
    await page.getByRole('heading', { name: 'Watchlist', exact: true }).waitFor()
    await expect.poll(() => detailsTrack(page), { timeout: 5_000 }).toBe(0)

    const search = page.getByRole('searchbox', { name: 'Search instruments' })
    await search.fill('300750')
    const follow = page.getByRole('button', { name: 'Follow 宁德时代', exact: true })
    await follow.waitFor({ timeout: 15_000 })
    await follow.click()

    const stock = page.getByRole('button', {
      name: 'Open investment record 宁德时代',
      exact: true,
    })
    await stock.waitFor({ timeout: 15_000 })
    await search.fill('')
    await stock.click()

    const details = page.locator('[class*="detailsCol"]').first()
    const collapse = details.getByRole('button', {
      name: 'Collapse investing details',
      exact: true,
    })
    await collapse.waitFor({ timeout: 15_000 })
    await expect.poll(() => detailsTrack(page), { timeout: 5_000 }).toBe(360)
    await details.getByRole('heading', { name: '宁德时代', exact: true }).waitFor()

    const evidenceTab = details.getByRole('tab', { name: 'Evidence', exact: true })
    const recordTab = details.getByRole('tab', { name: 'Record', exact: true })
    await expect.poll(() => evidenceTab.getAttribute('aria-selected')).toBe('true')
    expect(await recordTab.getAttribute('aria-selected')).toBe('false')
    await details.getByText(
      'Start a conversation; every source an answer draws on is listed here.',
      { exact: true },
    ).waitFor()
    const defaultEvidence = await captureStableAria(
      page,
      '[class*="detailsCol"]',
      scaffold.workspaceCwd,
    )

    await recordTab.click()
    expect(await evidenceTab.getAttribute('aria-selected')).toBe('false')
    await expect.poll(() => recordTab.getAttribute('aria-selected')).toBe('true')
    await details.getByRole('region', { name: 'Price trend', exact: true }).waitFor({ timeout: 15_000 })
    await details.getByRole('heading', { name: 'Investment rationale and record', exact: true }).waitFor()

    await collapse.click()
    await expect.poll(() => detailsTrack(page), { timeout: 5_000 }).toBe(0)
    expect(await appFrame(page).getAttribute('data-details-collapsed')).toBe('true')
    const collapsedWatchlist = await captureStableAria(
      page,
      '[class*="regionArea"]',
      scaffold.workspaceCwd,
    )

    await page.getByRole('button', { name: 'Expand investing details', exact: true }).click()
    await expect.poll(() => detailsTrack(page), { timeout: 5_000 }).toBe(360)
    expect(await appFrame(page).getAttribute('data-details-collapsed')).toBeNull()
    await collapse.waitFor()
    await expect.poll(() => recordTab.getAttribute('aria-selected')).toBe('true')
    await details.getByRole('region', { name: 'Price trend', exact: true }).waitFor()
    const watchlistBeforeDelete = await captureStableAria(
      page,
      '[class*="regionArea"]',
      scaffold.workspaceCwd,
    )
    const reopenedRecord = await captureStableAria(
      page,
      '[class*="detailsCol"]',
      scaffold.workspaceCwd,
    )

    await page.setViewportSize({ width: 1210, height: 1000 })
    await expect.poll(() => detailsTrack(page), { timeout: 5_000 }).toBe(0)
    await page.getByRole('button', { name: 'Expand investing details', exact: true }).click()
    await expect.poll(() => detailsTrack(page), { timeout: 5_000 }).toBe(300)
    await page.setViewportSize({ width: 1680, height: 1000 })
    await expect.poll(() => detailsTrack(page), { timeout: 5_000 }).toBe(360)

    const boundBeforeDelete = scaffold.ctx.nameRecord.sessions(CATL)
    expect(boundBeforeDelete).toHaveLength(1)
    const deletedSessionId = boundBeforeDelete[0]!
    await page.getByRole('button', { name: 'Delete conversation “archive”', exact: true }).click()
    const deleteDialog = page.getByRole('dialog', { name: 'Delete conversation record?', exact: true })
    await deleteDialog.waitFor()
    expect(await deleteDialog.textContent()).toContain('does not permanently delete logs')
    const deleteConfirmation = await captureStableAria(
      page,
      '[role="dialog"]',
      scaffold.workspaceCwd,
    )
    await deleteDialog.getByRole('button', { name: 'Delete conversation record', exact: true }).click()

    await deleteDialog.waitFor({ state: 'detached', timeout: 10_000 })
    await expect.poll(
      () => page.getByRole('button', { name: 'Delete conversation “archive”', exact: true }).count(),
      { timeout: 10_000 },
    ).toBe(0)
    await expect.poll(() => detailsTrack(page), { timeout: 5_000 }).toBe(0)
    await page.getByText(
      'Pick a name on the left to start a conversation about it.',
      { exact: true },
    ).waitFor()
    const deletedWatchlist = await captureStableAria(
      page,
      '[class*="regionArea"]',
      scaffold.workspaceCwd,
    )
    expect([...scaffold.ctx.workspaceRegistry.archivedSessionIds]).toContain(deletedSessionId)
    expect((await scaffold.ctx.sessionPersistence.list()).map(header => header.id)).toContain(deletedSessionId)
    expect(scaffold.ctx.nameRecord.sessions(CATL)).toContain(deletedSessionId)

    await compareOrRefreshGolden(
      CHICO_WORKBENCH_EXPECTED,
      chicoWorkbenchSnapshot(
        watchlistBeforeDelete,
        defaultEvidence,
        collapsedWatchlist,
        reopenedRecord,
        deleteConfirmation,
        deletedWatchlist,
      ),
      MODE,
    )

    const warningStart = tripwire.warnings.length
    await page.reload({ waitUntil: 'load' })
    acknowledgeReloadConnectionLoss(tripwire, warningStart)
    await appFrame(page).waitFor({ timeout: 30_000 })
    await page.getByRole('tab', { name: 'Investing', exact: true }).click()
    const reopenedStock = page.getByRole('button', {
      name: 'Open investment record 宁德时代',
      exact: true,
    })
    await reopenedStock.waitFor({ timeout: 15_000 })
    await reopenedStock.click()
    const reopenedDelete = page.getByRole('button', {
      name: 'Delete conversation “archive”',
      exact: true,
    })
    await expect.poll(() => reopenedDelete.count(), { timeout: 15_000 }).toBe(1)
    await expect.poll(
      () => page.getByRole('button', { name: 'archive', exact: true }).getAttribute('data-current'),
      { timeout: 5_000 },
    ).toBe('true')
    await expect.poll(
      () => page.getByText('Related conversations', { exact: true }).locator('..').locator('span').nth(1).textContent(),
      { timeout: 5_000 },
    ).toBe('1')
    const boundAfterReopen = scaffold.ctx.nameRecord.sessions(CATL)
    expect(boundAfterReopen).toHaveLength(2)
    expect(boundAfterReopen[0]).toBe(deletedSessionId)
    expect(boundAfterReopen[1]).not.toBe(deletedSessionId)
    expect([...scaffold.ctx.workspaceRegistry.archivedSessionIds]).toEqual([deletedSessionId])
    await assertFixtureInventory(CHICO_SNAPSHOT_DIR, ['workbench.expected.md'])
  }, 90_000)
})
