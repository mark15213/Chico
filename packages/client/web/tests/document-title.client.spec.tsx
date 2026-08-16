// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { DocumentTitle } from '../src/DocumentTitle.tsx'

afterEach(() => {
  cleanup()
  document.title = ''
})

describe('DocumentTitle', () => {
  it('preserves the product title without a durable title and restores it on unmount', () => {
    document.title = '蚂小财 Harness'
    const mounted = render(<DocumentTitle />)
    expect(document.title).toBe('蚂小财 Harness')

    mounted.rerender(<DocumentTitle title="First title" />)
    expect(document.title).toBe('First title — 蚂小财 Harness')

    mounted.rerender(<DocumentTitle title="Revised title" />)
    expect(document.title).toBe('Revised title — 蚂小财 Harness')

    mounted.rerender(<DocumentTitle />)
    expect(document.title).toBe('蚂小财 Harness')
    mounted.unmount()
    expect(document.title).toBe('蚂小财 Harness')
  })
})
