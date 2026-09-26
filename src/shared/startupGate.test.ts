import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createStartupGate } from './startupGate'

describe('the startup gate', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('opens once every part it waits for has reported, and not before', () => {
    const onOpen = vi.fn()
    const gate = createStartupGate(['settings', 'gallery'], onOpen, 5000)
    gate.ready('settings')
    expect(onOpen).not.toHaveBeenCalled()
    expect(gate.isOpen).toBe(false)
    gate.ready('gallery')
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(gate.isOpen).toBe(true)
  })

  it('does not care what order the parts report in', () => {
    const onOpen = vi.fn()
    const gate = createStartupGate(['a', 'b'], onOpen, 5000)
    gate.ready('b')
    gate.ready('a')
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('ignores a part reporting twice, and a part nobody was waiting for', () => {
    const onOpen = vi.fn()
    const gate = createStartupGate(['a', 'b'], onOpen, 5000)
    gate.ready('a')
    gate.ready('a')
    gate.ready('stranger')
    expect(onOpen).not.toHaveBeenCalled()
    gate.ready('b')
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('opens only once, even if parts keep reporting afterwards', () => {
    const onOpen = vi.fn()
    const gate = createStartupGate(['a'], onOpen, 5000)
    gate.ready('a')
    gate.ready('a')
    gate.open()
    vi.advanceTimersByTime(10_000)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('gives up waiting after the timeout, so a part that never reports cannot keep the screen up', () => {
    const onOpen = vi.fn()
    createStartupGate(['settings', 'gallery'], onOpen, 5000)
    vi.advanceTimersByTime(4999)
    expect(onOpen).not.toHaveBeenCalled()
    vi.advanceTimersByTime(2)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('cancels the timeout once it has opened on its own', () => {
    const onOpen = vi.fn()
    const gate = createStartupGate(['a'], onOpen, 5000)
    gate.ready('a')
    vi.advanceTimersByTime(20_000)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('opens at once if there is nothing to wait for', () => {
    const onOpen = vi.fn()
    const gate = createStartupGate([], onOpen, 5000)
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(gate.isOpen).toBe(true)
  })
})
