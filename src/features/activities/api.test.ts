import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteActivity, updateActivity } from './api'

const mock = vi.hoisted(() => {
  const query: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const name of ['update', 'delete', 'eq', 'select', 'maybeSingle', 'single']) query[name] = vi.fn()
  return { query, from: vi.fn(), getUser: vi.fn() }
})
vi.mock('../../lib/supabase', () => ({ supabase: { from: mock.from, auth: { getUser: mock.getUser } } }))

beforeEach(() => {
  vi.resetAllMocks()
  mock.from.mockReturnValue(mock.query)
  for (const name of ['update', 'delete', 'eq', 'select']) mock.query[name].mockReturnValue(mock.query)
  mock.getUser.mockResolvedValue({ data: { user: { id: 'host' } }, error: null })
  mock.query.maybeSingle.mockResolvedValue({ data: { id: 'activity' }, error: null })
  mock.query.single.mockResolvedValue({ data: { id: 'activity' }, error: null })
})

describe('host mutations', () => {
  it('rejects zero-row edits rather than reporting success', async () => {
    mock.query.maybeSingle.mockResolvedValue({ data: null, error: null })
    await expect(updateActivity('activity', { title: 'Volleyball' })).rejects.toThrow('not its host')
  })
  it('rejects zero-row cancellations', async () => {
    mock.query.maybeSingle.mockResolvedValue({ data: null, error: null })
    await expect(deleteActivity('activity')).rejects.toThrow('not its host')
  })
  it('does not forward forged ownership or derived fields', async () => {
    await updateActivity('activity', { title: '  Volleyball  ', host_id: 'other', participant_count: 99 } as Parameters<typeof updateActivity>[1])
    expect(mock.query.update).toHaveBeenCalledWith({ title: 'Volleyball' })
  })
  it('rejects unsigned callers before issuing a write', async () => {
    mock.getUser.mockResolvedValue({ data: { user: null }, error: null })
    await expect(deleteActivity('activity')).rejects.toThrow('sign in')
    expect(mock.from).not.toHaveBeenCalled()
  })
})
