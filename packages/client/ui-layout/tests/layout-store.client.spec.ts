// @vitest-environment jsdom
/**
 * createLayoutStore unit account: init shape, the action write set (clamp
 * inside actions), and the absence of browser persistence. Uses the
 * test-sanctioned path: factory self-call + .create() gives the
 * real engine instance (same create path as production).
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createLayoutStore } from '@deepseek-ai/dsh-client-ui-layout/src/client/stores.ts'
import {
  DEFAULT_MODE, DETAILS_DEFAULT, DETAILS_MAX, DETAILS_MIN,
  SIDEBAR_DEFAULT, SIDEBAR_MAX, SIDEBAR_MIN,
} from '@deepseek-ai/dsh-client-ui-layout/src/client/columns.ts'

const PERSIST_KEY = 'dsh.layout.panels'

beforeEach(() => { localStorage.clear() })

describe('createLayoutStore', () => {
  it('initializes the sidebar at its default width, details closed, wide viewport assumed', () => {
    const { store } = createLayoutStore().create()
    expect(store.getSnapshot())
      .toEqual({
        sidebar: SIDEBAR_DEFAULT,
        details: 0,
        narrow: false,
        narrowExpanded: false,
        detailsExpansionOverride: false,
        mode: DEFAULT_MODE,
        page: null,
      })
  })

  it('each create() is an independent instance (factory is not a singleton)', () => {
    const a = createLayoutStore().create()
    const b = createLayoutStore().create()
    a.actions.setSidebar(400)
    expect(b.store.getSnapshot().sidebar).toBe(SIDEBAR_DEFAULT)
  })

  it('setSidebar/setDetails clamp into the contract ranges', () => {
    const { store, actions } = createLayoutStore().create()
    actions.setSidebar(1)
    expect(store.getSnapshot().sidebar).toBe(SIDEBAR_MIN)
    actions.setSidebar(9999)
    expect(store.getSnapshot().sidebar).toBe(SIDEBAR_MAX)
    actions.setDetails(1)
    expect(store.getSnapshot().details).toBe(DETAILS_MIN)
    actions.setDetails(9999)
    expect(store.getSnapshot().details).toBe(DETAILS_MAX)
  })

  it('toggleSidebar flips closed <-> contract default (drag width forgotten)', () => {
    const { store, actions } = createLayoutStore().create()
    actions.setSidebar(400)
    actions.toggleSidebar()
    expect(store.getSnapshot().sidebar).toBe(0)
    actions.toggleSidebar()
    expect(store.getSnapshot().sidebar).toBe(SIDEBAR_DEFAULT)
  })

  it('narrow toggleSidebar flips only the re-expand override; the width preference survives', () => {
    const { store, actions } = createLayoutStore().create()
    actions.setSidebar(400)
    actions.setNarrow(true)
    actions.toggleSidebar()
    expect(store.getSnapshot()).toEqual({
      sidebar: 400,
      details: 0,
      narrow: true,
      narrowExpanded: true,
      detailsExpansionOverride: false,
      mode: DEFAULT_MODE,
      page: null,
    })
    actions.toggleSidebar()
    expect(store.getSnapshot().narrowExpanded).toBe(false)
    expect(store.getSnapshot().sidebar).toBe(400)
  })

  it('crossing the breakpoint drops the override; a same-value setNarrow keeps it', () => {
    const { store, actions } = createLayoutStore().create()
    actions.setNarrow(true)
    actions.toggleSidebar()
    expect(store.getSnapshot().narrowExpanded).toBe(true)
    actions.setNarrow(true)
    expect(store.getSnapshot().narrowExpanded).toBe(true)
    actions.setNarrow(false)
    expect(store.getSnapshot()).toMatchObject({ narrow: false, narrowExpanded: false })
    actions.setNarrow(true)
    expect(store.getSnapshot().narrowExpanded).toBe(false)
  })

  it('openDetails uses the contract default, preserves an open width, and closeDetails zeroes', () => {
    const { store, actions } = createLayoutStore().create()
    actions.openDetails()
    expect(store.getSnapshot().details).toBe(DETAILS_DEFAULT)
    actions.setDetails(500)
    actions.openDetails()
    expect(store.getSnapshot().details).toBe(500)
    actions.closeDetails()
    expect(store.getSnapshot().details).toBe(0)
    expect(store.getSnapshot().detailsExpansionOverride).toBe(false)
  })

  it('restoreDetails records a manual concession override until close or frame switch', () => {
    const { store, actions } = createLayoutStore().create()
    actions.restoreDetails()
    expect(store.getSnapshot()).toMatchObject({
      details: DETAILS_DEFAULT,
      detailsExpansionOverride: true,
    })
    actions.setDetails(500)
    expect(store.getSnapshot().detailsExpansionOverride).toBe(true)
    actions.releaseDetailsExpansion()
    expect(store.getSnapshot()).toMatchObject({
      details: 500,
      detailsExpansionOverride: false,
    })
    actions.restoreDetails()
    actions.closeDetails()
    expect(store.getSnapshot()).toMatchObject({ details: 0, detailsExpansionOverride: false })
    actions.restoreDetails()
    actions.setMode('names')
    expect(store.getSnapshot()).toMatchObject({
      mode: 'names',
      details: 0,
      detailsExpansionOverride: false,
    })
  })

  it('does not persist panel geometry', () => {
    const first = createLayoutStore().create()
    first.actions.setSidebar(400)
    first.actions.openDetails()
    first.actions.setDetails(500)
    expect(localStorage.getItem(PERSIST_KEY)).toBeNull()

    const second = createLayoutStore().create()
    expect(second.store.getSnapshot()).toEqual({
      sidebar: SIDEBAR_DEFAULT,
      details: 0,
      narrow: false,
      narrowExpanded: false,
      detailsExpansionOverride: false,
      mode: DEFAULT_MODE,
      page: null,
    })
  })

  it('switches frame and closes the details panel on the way', () => {
    const { store, actions } = createLayoutStore().create()
    actions.openDetails()

    actions.setMode('names')

    // The details occupant changes with the mode, so an open panel would swap
    // contents under a reader who was looking at something else.
    expect(store.getSnapshot()).toMatchObject({ mode: 'names', details: 0 })
  })

  it('leaves an open details panel alone when the frame does not change', () => {
    const { store, actions } = createLayoutStore().create()
    actions.openDetails()
    const open = store.getSnapshot().details

    actions.setMode(DEFAULT_MODE)

    expect(store.getSnapshot().details).toBe(open)
  })

  it('opens a page over the centre column and closes the details panel on the way', () => {
    const { store, actions } = createLayoutStore().create()
    actions.restoreDetails()

    actions.openPage('automation')

    expect(store.getSnapshot()).toMatchObject({
      page: 'automation',
      details: 0,
      detailsExpansionOverride: false,
    })
  })

  it('leaves an open details panel alone when the page does not change', () => {
    const { store, actions } = createLayoutStore().create()
    actions.openPage('automation')
    actions.openDetails()
    const open = store.getSnapshot().details

    actions.openPage('automation')

    expect(store.getSnapshot().details).toBe(open)
  })

  it('closing the page returns the centre column and closes the details panel', () => {
    const { store, actions } = createLayoutStore().create()
    actions.openPage('automation')
    actions.restoreDetails()

    actions.closePage()

    expect(store.getSnapshot()).toMatchObject({
      page: null,
      details: 0,
      detailsExpansionOverride: false,
    })
  })

  it('closing with no page open leaves the details panel alone', () => {
    const { store, actions } = createLayoutStore().create()
    actions.openDetails()
    const open = store.getSnapshot().details

    actions.closePage()

    expect(store.getSnapshot().details).toBe(open)
  })

  // A page belongs to the frame that offered it, so it cannot outlive a switch
  // to a frame whose navigation never mentions it.
  it('switching frame drops the open page', () => {
    const { store, actions } = createLayoutStore().create()
    actions.openPage('automation')

    actions.setMode('names')

    expect(store.getSnapshot()).toMatchObject({ mode: 'names', page: null })
  })
})
