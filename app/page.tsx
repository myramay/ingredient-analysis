import Header from '@/app/components/Header';
import InputForm from '@/app/components/InputForm';

export default function Home() {
  return (
    <div className="flex flex-col flex-1 min-h-screen bg-pink-mesh">
      <Header />

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 pb-16">
        {/* Hero tagline */}
        <div className="text-center mb-8 space-y-2">
          <p className="text-xl font-semibold leading-snug" style={{ color: '#4a1530' }}>
            Paste your ingredient list.
          </p>
          <p className="text-sm" style={{ color: '#a8547a' }}>
            Get instant plain-English analysis, safety flags, and a transparency score.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {['Safety Flags', 'Transparency Score', 'Ingredient Explanations', 'Smarter Alternatives'].map((f) => (
              <span
                key={f}
                className="text-xs px-3 py-1 rounded-full font-medium"
                style={{ background: 'rgba(244,63,122,0.1)', color: '#be185d', border: '1px solid rgba(244,63,122,0.2)' }}
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        <InputForm />
      </main>

      <footer className="py-5 text-center text-xs" style={{ color: '#c4879a' }}>
        ClearSkin AI &mdash; Powered by GPT-4o mini &bull; Not medical advice
      </footer>
    </div>
  );
}
