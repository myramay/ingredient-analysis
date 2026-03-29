export default function Header() {
  return (
    <header className="w-full py-6 px-4 flex flex-col items-center gap-1 select-none">
      <div className="flex items-center gap-2">
        <span className="text-3xl" aria-hidden>✨</span>
        <h1 className="text-3xl font-bold tracking-tight"
          style={{ background: 'linear-gradient(135deg, #f43f7a 0%, #be185d 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          ClearSkin AI
        </h1>
        <span className="text-3xl" aria-hidden>✨</span>
      </div>
      <p className="text-sm text-pink-400 font-medium tracking-wide" style={{ color: '#d4739a' }}>
        Know exactly what's in your products
      </p>
    </header>
  );
}
