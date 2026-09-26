import { useSettings } from './useSettings'
import { NUMBERS_PRESETS, type NumbersPreset } from './numbers'
import './WelcomeQuestion.css'

const CHOICES: { preset: NumbersPreset; title: string; body: string }[] = [
  {
    preset: 'story',
    title: 'The story and the abilities',
    body: 'A champion\'s identity, lore and splash art, and what each ability does, in words. No numbers to fill in.',
  },
  {
    preset: 'full',
    title: 'The full picture',
    body: 'Everything in the story, plus base stats, item builds, ability numbers and a win-rate projection.',
  },
]

// Asked once, before anything else: how much of the numbers this person wants. Either answer only
// decides what is shown to begin with; Settings has a switch for each part, so nobody is locked out
// of the other side.
export default function WelcomeQuestion() {
  const loaded = useSettings(s => s.loaded)
  const done = useSettings(s => s.settings.welcome_done)
  const update = useSettings(s => s.update)

  if (!loaded || done) return null

  return (
    <div className="welcome-overlay">
      <div className="welcome-dialog" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
        <div className="welcome-eyebrow">Welcome to Summoner</div>
        <h1 className="welcome-title" id="welcome-title">What will you use it for?</h1>
        <div className="welcome-choices">
          {CHOICES.map(c => (
            <button
              key={c.preset}
              className="welcome-choice"
              onClick={() => update({ ...NUMBERS_PRESETS[c.preset], welcome_done: true })}
            >
              <span className="welcome-choice-title">{c.title}</span>
              <span className="welcome-choice-body">{c.body}</span>
            </button>
          ))}
        </div>
        <p className="welcome-note">You can change this any time in Settings, under Numbers.</p>
      </div>
    </div>
  )
}
