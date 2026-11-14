import { Check, RotateCcw, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { demoPersonas } from '../domain/world'
import { useActive, useWorld } from '../store/hooks'
import { useAppStore } from '../store/storeContext'
import { Button } from '../ui/primitives'

/** Demo control: switch between the scripted personas, or reset all demo data. */
export function PersonaSwitcher() {
  const dialog = useRef<HTMLDialogElement>(null)
  const world = useWorld()
  const { account } = useActive()
  const setActiveAccount = useAppStore((s) => s.setActiveAccount)
  const resetDemo = useAppStore((s) => s.resetDemo)
  const navigate = useNavigate()
  const [confirmingReset, setConfirmingReset] = useState(false)
  const personas = demoPersonas(world)

  const close = () => {
    setConfirmingReset(false)
    dialog.current?.close()
  }

  const choose = (id: string) => {
    setActiveAccount(id)
    close()
    navigate('/feed')
  }

  const reset = () => {
    resetDemo()
    close()
    navigate('/feed')
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-hairline bg-surface py-1 pr-3 pl-1 text-[14px] font-semibold"
        aria-haspopup="dialog"
      >
        <span
          aria-hidden="true"
          className="grid size-8 place-items-center rounded-full bg-ink text-[13px] font-bold text-white"
        >
          {account.displayName.slice(0, 1)}
        </span>
        <span className="whitespace-nowrap">
          <span className="sr-only">Viewing as </span>
          {account.demoPersona?.label ?? account.displayName}
        </span>
      </button>

      <dialog
        ref={dialog}
        aria-labelledby="persona-title"
        onClose={() => setConfirmingReset(false)}
        onClick={(e) => {
          // A click on the dialog element itself (not its content) is a click on the backdrop.
          if (e.target === e.currentTarget) close()
        }}
        className="m-auto mb-0 w-full max-w-lg rounded-t-[var(--radius-panel)] bg-surface p-0 text-ink backdrop:bg-ink/40 sm:mb-auto sm:rounded-[var(--radius-panel)]"
      >
        <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
          <h2 id="persona-title" className="text-lg font-semibold">
            View the demo as
          </h2>
          <button type="button" onClick={close} aria-label="Close" className="grid size-11 place-items-center rounded-full">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <ul className="divide-y divide-hairline">
          {personas.map((p) => {
            const active = p.id === account.id
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => choose(p.id)}
                  aria-current={active ? 'true' : undefined}
                  className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-paper"
                >
                  <span className="flex-1">
                    <span className="block font-semibold">{p.demoPersona?.label}</span>
                    <span className="block text-[14px] text-ink-muted">{p.demoPersona?.description}</span>
                  </span>
                  {active && <Check size={20} className="text-chart-blue" aria-label="Current" />}
                </button>
              </li>
            )
          })}
        </ul>

        <div className="border-t border-hairline p-4">
          {confirmingReset ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="flex-1 text-[14px]">Erase every change made in this demo?</p>
              <Button onClick={() => setConfirmingReset(false)}>Cancel</Button>
              <Button tone="danger" onClick={reset}>
                Reset demo
              </Button>
            </div>
          ) : (
            <Button onClick={() => setConfirmingReset(true)}>
              <RotateCcw size={16} aria-hidden="true" />
              Reset demo
            </Button>
          )}
        </div>
      </dialog>
    </>
  )
}
