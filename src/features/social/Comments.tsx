import { type FormEvent, useState } from 'react'
import { COMMENT_MAX } from '../../domain/schemas'
import { accountById, canComment, checkCommentText, commentsFor } from '../../domain/social'
import type { Flight } from '../../domain/types'
import { useActive, useWorld } from '../../store/hooks'
import { useAppStore } from '../../store/storeContext'
import { Button } from '../../ui/primitives'
import { PersonLink } from './PersonLink'
import { ReportButton } from './ReportButton'

const when = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export function Comments({ flight }: { flight: Flight }) {
  const world = useWorld()
  const { account } = useActive()
  const addComment = useAppStore((s) => s.addComment)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const comments = commentsFor(world, account.id, flight.id)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const check = checkCommentText(text)
    if (!check.ok) {
      setError(check.error)
      return
    }
    addComment(flight.id, check.text)
    setText('')
    setError(null)
  }

  return (
    <section aria-labelledby="comments-title" className="flex flex-col gap-3">
      <h2 id="comments-title" className="font-semibold">
        Comments
      </h2>
      {comments.length === 0 ? (
        <p className="text-ink-muted">No comments yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {comments.map((c) => {
            const author = accountById(world, c.authorId)
            return (
              <li key={c.id} className="flex flex-col gap-1">
                <p className="flex items-baseline justify-between gap-2 text-[14px]">
                  <span>
                    {author ? <PersonLink account={author} /> : 'Former member'}{' '}
                    <span className="text-ink-muted">{when(c.at)}</span>
                  </span>
                  {c.authorId !== account.id && <ReportButton target={{ kind: 'comment', id: c.id }} subject="comment" />}
                </p>
                <p className="max-w-[60ch]">{c.text}</p>
              </li>
            )
          })}
        </ul>
      )}
      {canComment(world, account.id, flight) && (
        <form onSubmit={submit} className="flex flex-col gap-2">
          <label htmlFor="comment-text" className="text-[14px] text-ink-muted">
            Add a comment
          </label>
          <textarea
            id="comment-text"
            value={text}
            maxLength={COMMENT_MAX}
            rows={2}
            onChange={(e) => setText(e.target.value)}
            aria-invalid={error !== null}
            aria-describedby={error ? 'comment-error' : undefined}
            className="rounded-[var(--radius-control)] border border-hairline bg-surface px-3 py-2"
          />
          {error && (
            <p id="comment-error" className="text-[14px] text-danger">
              {error}
            </p>
          )}
          <Button type="submit" className="self-start">
            Post comment
          </Button>
        </form>
      )}
    </section>
  )
}
