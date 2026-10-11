/**
 * WoCow · Activities API
 * Owner: Person 3 (Data)
 *
 * This is the agreed shared interface. Person 1 (UI), Person 2 (Map) and
 * Person 4 (Matching) only ever call these functions — nobody else writes
 * `supabase.from(...)` queries, so a schema change lands in exactly one file.
 *
 *   getActivities(filters)   list the feed
 *   getActivity(id)          one activity
 *   createActivity(input)    host a new activity
 *   updateActivity(id, ...)  host edits their own
 *   deleteActivity(id)       host cancels their own
 *   joinActivity(id)         atomic join (capacity-safe)
 *   leaveActivity(id)        leave
 *   getParticipants(id)      who is coming
 *   getMyActivities()        hosted + joined
 */
import { supabase } from '../../lib/supabase'
import type {
  ActivityFeedRow,
  ActivityParticipant,
  NewActivityInput,
} from '../../lib/types'

/** Every error the UI shows is one of these, so messages stay human. */
export class WoCowError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'WoCowError'
  }
}

export interface ActivityFilters {
  categories?: string[]
  /** Free-text match against title, location and category. */
  search?: string
  /** Only activities starting at/after this ISO timestamp. */
  from?: string
  /** Only activities starting at/before this ISO timestamp. */
  to?: string
  /** Include activities that already finished. Defaults to false. */
  includePast?: boolean
  /** Hide activities with no free slots. Defaults to false. */
  hideFull?: boolean
  limit?: number
}

const FEED_TABLE = 'activity_feed'

/** Explicit writable fields prevent runtime payloads from changing ownership. */
function writableFields(input: Partial<NewActivityInput>): Partial<NewActivityInput> {
  const result: Partial<NewActivityInput> = {}
  const fields = ['title', 'description', 'category', 'location_name', 'latitude',
    'longitude', 'max_participants', 'starts_at', 'ends_at'] as const
  for (const field of fields) {
    if (input[field] !== undefined) Object.assign(result, { [field]: input[field] })
  }
  for (const field of ['title', 'category', 'location_name'] as const) {
    if (result[field] !== undefined) result[field] = result[field]!.trim()
  }
  return result
}

/**
 * Turns raw Postgres/PostgREST failures into something a student can read.
 * The messages raised by public.join_activity() arrive here verbatim.
 */
function toWoCowError(
  error: { message?: string; code?: string; details?: string } | null,
  fallback: string,
): WoCowError {
  const message = error?.message ?? ''

  if (/already full/i.test(message)) {
    return new WoCowError('That activity just filled up — try another one.')
  }
  if (/no longer exists/i.test(message)) {
    return new WoCowError('That activity was cancelled or deleted.')
  }
  if (/must be signed in/i.test(message)) {
    return new WoCowError('Please sign in first.')
  }
  if (/already ended/i.test(message)) {
    return new WoCowError('That activity has already ended.')
  }
  if (/Capacity cannot/i.test(message)) return new WoCowError(message)
  if (error?.code === '23505') {
    return new WoCowError('You have already joined this activity.')
  }
  if (error?.code === '23514') {
    return new WoCowError(
      'Those values are out of range — check the end time is after the start time and the limit is above zero.',
    )
  }
  if (
    error?.code === '42501' ||
    /row-level security|permission denied/i.test(message)
  ) {
    return new WoCowError('You do not have permission to do that.')
  }
  if (!message) {
    return new WoCowError(fallback)
  }
  return new WoCowError(message)
}

/** Reads the current user's id, or throws a friendly error. */
async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    throw new WoCowError('Please sign in to do that.')
  }
  return data.user.id
}

// -----------------------------------------------------------------------------
// Reads
// -----------------------------------------------------------------------------

/**
 * The main feed, ordered by start time.
 *
 * Runs against the `activity_feed` view, which already carries
 * participant_count / is_full / is_joined, so the client never has to
 * aggregate or issue N+1 queries.
 */
export async function getActivities(
  filters: ActivityFilters = {},
): Promise<ActivityFeedRow[]> {
  let query = supabase
    .from(FEED_TABLE)
    .select('*')
    .order('starts_at', { ascending: true })

  if (!filters.includePast) {
    query = query.gte('ends_at', new Date().toISOString())
  }
  if (filters.categories?.length) {
    query = query.in('category', filters.categories)
  }
  if (filters.from) {
    query = query.gte('starts_at', filters.from)
  }
  if (filters.to) {
    query = query.lte('starts_at', filters.to)
  }
  if (filters.hideFull) {
    query = query.eq('is_full', false)
  }
  if (filters.search?.trim()) {
    // Strip PostgREST filter syntax characters so a stray comma or bracket in
    // the search box cannot break out of the .or() expression.
    const term = filters.search.trim().replace(/[%,()*\\]/g, '')
    if (term) {
      query = query.or(
        `title.ilike.%${term}%,location_name.ilike.%${term}%,category.ilike.%${term}%`,
      )
    }
  }
  if (filters.limit) {
    query = query.limit(filters.limit)
  }

  const { data, error } = await query
  if (error) throw toWoCowError(error, 'Could not load activities.')
  return (data ?? []) as ActivityFeedRow[]
}

/** A single activity from the feed view. */
export async function getActivity(id: string): Promise<ActivityFeedRow> {
  const { data, error } = await supabase
    .from(FEED_TABLE)
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw toWoCowError(error, 'Could not load that activity.')
  return data as ActivityFeedRow
}

/** Who has joined, oldest join first. */
export async function getParticipants(
  activityId: string,
): Promise<ActivityParticipant[]> {
  const { data, error } = await supabase
    .from('activity_participants')
    .select('activity_id, user_id, joined_at')
    .eq('activity_id', activityId)
    .order('joined_at', { ascending: true })

  if (error) throw toWoCowError(error, 'Could not load the participant list.')
  return (data ?? []) as ActivityParticipant[]
}

/** Activities this user is hosting, and activities they joined. */
export async function getMyActivities(): Promise<{
  hosting: ActivityFeedRow[]
  joined: ActivityFeedRow[]
}> {
  const userId = await requireUserId()

  const { data, error } = await supabase
    .from(FEED_TABLE)
    .select('*')
    .or(`host_id.eq.${userId},is_joined.eq.true`)
    .order('starts_at', { ascending: true })

  if (error) throw toWoCowError(error, 'Could not load your activities.')

  const rows = (data ?? []) as ActivityFeedRow[]
  return {
    hosting: rows.filter((row) => row.host_id === userId),
    joined: rows.filter((row) => row.is_joined && row.host_id !== userId),
  }
}

// -----------------------------------------------------------------------------
// Writes
// -----------------------------------------------------------------------------

/** Creates an activity hosted by the signed-in user. */
export async function createActivity(
  input: NewActivityInput,
): Promise<ActivityFeedRow> {
  const userId = await requireUserId()

  const { data, error } = await supabase
    .from('activities')
    .insert({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      category: input.category,
      location_name: input.location_name.trim(),
      latitude: input.latitude,
      longitude: input.longitude,
      max_participants: input.max_participants,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      // Must equal auth.uid() or the RLS INSERT policy rejects the row.
      host_id: userId,
    })
    .select('id')
    .single()

  if (error) throw toWoCowError(error, 'Could not create the activity.')
  return getActivity((data as { id: string }).id)
}

/** Host-only edit. RLS silently blocks anyone else. */
export async function updateActivity(
  id: string,
  patch: Partial<NewActivityInput>,
): Promise<ActivityFeedRow> {
  await requireUserId()
  const { data, error } = await supabase.from('activities').update(writableFields(patch)).eq('id', id).select('id').maybeSingle()
  if (error) throw toWoCowError(error, 'Could not update the activity.')
  if (!data) throw new WoCowError('Activity not found or you are not its host.')
  return getActivity(id)
}

/** Host-only cancel. Participants cascade away via the FK. */
export async function deleteActivity(id: string): Promise<void> {
  await requireUserId()
  const { data, error } = await supabase.from('activities').delete().eq('id', id).select('id').maybeSingle()
  if (error) throw toWoCowError(error, 'Could not delete the activity.')
  if (!data) throw new WoCowError('Activity not found or you are not its host.')
}

/**
 * Joins an activity through the `join_activity` RPC.
 *
 * The capacity check and the insert happen inside one transaction that holds
 * a row lock, so two people tapping "Join" simultaneously can never overshoot
 * max_participants. Do NOT replace this with a client-side count + insert.
 */
export async function joinActivity(activityId: string): Promise<ActivityFeedRow> {
  const { data, error } = await supabase.rpc('join_activity', {
    p_activity_id: activityId,
  })

  if (error) throw toWoCowError(error, 'Could not join the activity.')

  // A function returning a composite type comes back as a single object; be
  // tolerant in case PostgREST wraps it in an array.
  const row = (Array.isArray(data) ? data[0] : data) as ActivityFeedRow | null
  if (!row) throw new WoCowError('Joined, but could not reload the activity.')
  return row
}

/** Leaves an activity. Safe to call when not joined. */
export async function leaveActivity(activityId: string): Promise<ActivityFeedRow> {
  const { data, error } = await supabase.rpc('leave_activity', {
    p_activity_id: activityId,
  })

  if (error) throw toWoCowError(error, 'Could not leave the activity.')

  const row = (Array.isArray(data) ? data[0] : data) as ActivityFeedRow | null
  if (!row) throw new WoCowError('Left, but could not reload the activity.')
  return row
}
